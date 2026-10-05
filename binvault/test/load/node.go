package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// node is one binvault process on a data directory of its own.
type node struct {
	bin       string
	dir       string // root of this node's files
	data      string // BINVAULT_DATA_DIR
	adminTok  string
	masterKey string
	fsync     bool
	extraEnv  []string

	cmd      *exec.Cmd
	s3Addr   string
	adminURL string
	logFile  *os.File
	exited   chan struct{}
}

func newNode(bin, dir string, fsync bool, extraEnv ...string) *node {
	tok := make([]byte, 24)
	key := make([]byte, 32)
	_, _ = rand.Read(tok)
	_, _ = rand.Read(key)
	return &node{bin: bin, dir: dir, data: filepath.Join(dir, "data"), adminTok: hex.EncodeToString(tok), masterKey: base64.StdEncoding.EncodeToString(key), fsync: fsync, extraEnv: extraEnv}
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func (n *node) env(s3port, adminPort int) []string {
	env := []string{
		"PATH=" + os.Getenv("PATH"), "HOME=" + os.Getenv("HOME"),
		"BINVAULT_ADMIN_TOKEN=" + n.adminTok, "BINVAULT_MASTER_KEY=" + n.masterKey, "BINVAULT_DATA_DIR=" + n.data,
		"BINVAULT_LISTEN=127.0.0.1:" + strconv.Itoa(s3port), "BINVAULT_ADMIN_LISTEN=127.0.0.1:" + strconv.Itoa(adminPort),
		"BINVAULT_ENDPOINT_URL=http://127.0.0.1:" + strconv.Itoa(s3port), "BINVAULT_MIN_FREE_MB=1", "BINVAULT_AUTH_FAIL_LIMIT=1000000",
		"BINVAULT_FSYNC=" + strconv.FormatBool(n.fsync), "BINVAULT_LOG_LEVEL=warn",
	}
	return append(env, n.extraEnv...)
}

// start launches the process and waits until /_healthz answers 200.
func (n *node) start() error {
	if err := os.MkdirAll(n.dir, 0o755); err != nil {
		return err
	}
	for try := 0; try < 5; try++ {
		sp, err := freePort()
		if err != nil {
			return err
		}
		ap, err := freePort()
		if err != nil || ap == sp {
			continue
		}
		lf, err := os.OpenFile(filepath.Join(n.dir, "node.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return err
		}
		cmd := exec.Command(n.bin, "run")
		cmd.Env = n.env(sp, ap)
		cmd.Stdout, cmd.Stderr = lf, lf
		if err := cmd.Start(); err != nil {
			lf.Close()
			return err
		}
		n.cmd, n.logFile = cmd, lf
		n.s3Addr = "127.0.0.1:" + strconv.Itoa(sp)
		n.adminURL = "http://127.0.0.1:" + strconv.Itoa(ap)
		n.exited = make(chan struct{})
		go func() { _ = cmd.Wait(); close(n.exited) }()
		deadline := time.Now().Add(60 * time.Second)
		for time.Now().Before(deadline) {
			select {
			case <-n.exited:
				goto retry
			default:
			}
			resp, err := http.Get("http://" + n.s3Addr + "/_healthz")
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode == 200 {
					return nil
				}
			}
			time.Sleep(50 * time.Millisecond)
		}
		_ = cmd.Process.Kill()
		return fmt.Errorf("node did not become healthy; log: %s", n.tail(1500))
	retry:
		lf.Close()
		if !strings.Contains(n.tail(4000), "address already in use") {
			return fmt.Errorf("node exited during start-up: %s", n.tail(1500))
		}
	}
	return errors.New("no free ports")
}

func (n *node) tail(max int) string {
	b, _ := os.ReadFile(filepath.Join(n.dir, "node.log"))
	if len(b) > max {
		b = b[len(b)-max:]
	}
	return string(b)
}

func (n *node) pid() int { return n.cmd.Process.Pid }

// kill9 sends SIGKILL and waits for the process to be gone.
func (n *node) kill9() {
	if n.cmd == nil || n.cmd.Process == nil {
		return
	}
	_ = n.cmd.Process.Kill()
	<-n.exited
	if n.logFile != nil {
		n.logFile.Close()
	}
}

// stop is a graceful shutdown (SIGTERM).
func (n *node) stop() {
	if n.cmd == nil || n.cmd.Process == nil {
		return
	}
	select {
	case <-n.exited:
		return
	default:
	}
	_ = n.cmd.Process.Signal(syscall.SIGTERM)
	select {
	case <-n.exited:
	case <-time.After(60 * time.Second):
		_ = n.cmd.Process.Kill()
		<-n.exited
	}
	if n.logFile != nil {
		n.logFile.Close()
	}
}

// cli runs `binvault <args>` on this node's data dir; returns the exit code and the combined output.
func (n *node) cli(args ...string) (int, string) {
	cmd := exec.Command(n.bin, args...)
	cmd.Env = n.env(1, 2) // the ports are not used by validate
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	code := 0
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			code = ee.ExitCode()
		} else {
			code = -1
			out.WriteString(err.Error())
		}
	}
	return code, out.String()
}

// admin calls the admin API.
func (n *node) admin(method, path string, body any) (int, map[string]any, error) {
	var rd io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	}
	req, _ := http.NewRequestWithContext(context.Background(), method, n.adminURL+"/_admin/v1"+path, rd)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out, nil
}

// bucket creates a bucket and a full-access token; returns a client.
func (n *node) bucket(name string, settings map[string]any) (*client, error) {
	body := map[string]any{"name": name}
	for k, v := range settings {
		body[k] = v
	}
	st, out, err := n.admin("POST", "/buckets", body)
	if err != nil || st != 201 {
		return nil, fmt.Errorf("create bucket %s: %d %v %v", name, st, out, err)
	}
	st, out, err = n.admin("POST", "/buckets/"+name+"/tokens", map[string]any{"name": "load", "grants": []any{map[string]any{"actions": []string{"read", "write", "list", "delete", "purge", "tag"}}}})
	if err != nil || st != 201 {
		return nil, fmt.Errorf("create token: %d %v %v", st, out, err)
	}
	return &client{host: n.s3Addr, bucket: name, ak: out["access_key_id"].(string), sk: out["secret_access_key"].(string), region: "us-east-1", hc: newHTTPClient()}, nil
}

// reopen rebinds a client to the node's new address after a restart (same bucket, same token).
func (n *node) reopen(c *client) *client {
	cp := *c
	cp.host = n.s3Addr
	cp.hc = newHTTPClient()
	return &cp
}

// rss samples the resident set size of the process (KiB) with ps until stop is closed; returns the peak and the last value.
type rssSampler struct {
	mu   sync.Mutex
	peak int64
	last int64
	stop chan struct{}
	done chan struct{}
}

func sampleRSS(pid int) *rssSampler {
	s := &rssSampler{stop: make(chan struct{}), done: make(chan struct{})}
	go func() {
		defer close(s.done)
		tick := time.NewTicker(100 * time.Millisecond)
		defer tick.Stop()
		for {
			if v := readRSS(pid); v > 0 {
				s.mu.Lock()
				if v > s.peak {
					s.peak = v
				}
				s.last = v
				s.mu.Unlock()
			}
			select {
			case <-s.stop:
				return
			case <-tick.C:
			}
		}
	}()
	return s
}

func (s *rssSampler) finish() (peakKiB int64) {
	close(s.stop)
	<-s.done
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.peak
}

func readRSS(pid int) int64 {
	out, err := exec.Command("ps", "-o", "rss=", "-p", strconv.Itoa(pid)).Output()
	if err != nil {
		return 0
	}
	v, _ := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
	return v
}

func dirBytes(dir string) int64 {
	var total int64
	_ = filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && info.Mode().IsRegular() {
			total += info.Size()
		}
		return nil
	})
	return total
}

func countFiles(dir string) int {
	n := 0
	_ = filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && info.Mode().IsRegular() {
			n++
		}
		return nil
	})
	return n
}
