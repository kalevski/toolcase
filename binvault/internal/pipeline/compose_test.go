package pipeline_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

// freePort returns a TCP port nothing listens on.
func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}

func moduleRoot(t *testing.T) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..")
}

// TestComposeSetupAgainstTheSampleService runs docker/setup.sh and
// docker/sample-service against a node, the way docker/compose.yml wires them:
// a content-gate before pipeline that rejects a marker string, and a tag-hash
// after pipeline that records the SHA-256 of what was stored.
func TestComposeSetupAgainstTheSampleService(t *testing.T) {
	if testing.Short() {
		t.Skip("builds and runs the sample service")
	}
	curl, err := exec.LookPath("curl")
	if err != nil {
		t.Skip("curl is not installed")
	}
	goBin, err := exec.LookPath("go")
	if err != nil {
		goBin = filepath.Join(runtime.GOROOT(), "bin", "go")
	}
	root := moduleRoot(t)
	bin := filepath.Join(t.TempDir(), "sample-service")
	build := exec.Command(goBin, "build", "-o", bin, "./docker/sample-service")
	build.Dir = root
	if out, err := build.CombinedOutput(); err != nil {
		t.Skipf("cannot build the sample service: %v\n%s", err, out)
	}

	svcPort := freePort(t)
	const secret = "change-me-to-at-least-32-characters-long"
	svc := exec.Command(bin)
	svc.Env = append(os.Environ(), "LISTEN=127.0.0.1:"+strconv.Itoa(svcPort), "SIGNING_SECRET="+secret)
	var svcLog bytes.Buffer
	svc.Stdout, svc.Stderr = &svcLog, &svcLog
	if err := svc.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = svc.Process.Kill(); _ = svc.Wait() })
	eventually(t, 10*time.Second, "the sample service to listen", func() bool {
		c, err := net.DialTimeout("tcp", "127.0.0.1:"+strconv.Itoa(svcPort), 200*time.Millisecond)
		if err == nil {
			c.Close()
		}
		return err == nil
	})

	s3Port := freePort(t)
	n := startNode(t, "", func(c *config.Config) {
		c.Listen = "127.0.0.1:" + strconv.Itoa(s3Port)
		c.EndpointURL = "http://127.0.0.1:" + strconv.Itoa(s3Port)
	})

	// docker/setup.sh, pointed at this node and service
	script, err := os.ReadFile(filepath.Join(root, "docker", "setup.sh"))
	if err != nil {
		t.Fatal(err)
	}
	adm := strings.TrimPrefix(n.adminURL, "http://")
	text := strings.ReplaceAll(string(script), "binvault:9001", adm)
	text = strings.ReplaceAll(text, "sample-service:8080", "127.0.0.1:"+strconv.Itoa(svcPort))
	sh := exec.Command("/bin/sh", "-c", text)
	sh.Env = append(os.Environ(), "ADMIN="+n.adminTok, "SIGNING_SECRET="+secret, "PATH="+filepath.Dir(curl)+":"+os.Getenv("PATH"))
	out, err := sh.CombinedOutput()
	if err != nil {
		t.Fatalf("setup.sh: %v\n%s", err, out)
	}
	// the last JSON object printed is the token
	var tok struct {
		AccessKeyID     string `json:"access_key_id"`
		SecretAccessKey string `json:"secret_access_key"`
	}
	line := ""
	for _, l := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(l, "{") {
			line = l
		}
	}
	if json.Unmarshal([]byte(line), &tok) != nil || tok.AccessKeyID == "" {
		t.Fatalf("no credentials in the output of setup.sh:\n%s", out)
	}
	c := cred{tok.AccessKeyID, tok.SecretAccessKey}

	// the two pipelines are defined and attached, in order
	att := n.mustAdmin(200, "GET", "/buckets/demo/pipelines", nil)
	items := att["items"].([]any)
	if len(items) != 2 || items[0].(map[string]any)["pipeline"] != "content-gate" || items[1].(map[string]any)["pipeline"] != "tag-hash" {
		t.Fatalf("attachments: %v", att)
	}
	gate := n.mustAdmin(200, "GET", "/pipelines/content-gate", nil)
	if gate["service"].(map[string]any)["has_signing_secret"] != true || gate["stage"] != "before" {
		t.Fatalf("content-gate: %v", gate)
	}

	// clean upload: accepted, then tagged by the after pipeline
	n.must(c, 200, "PUT", objPath("demo", "uploads/ok.txt"), []byte("a perfectly fine file"))
	want := sha256hex([]byte("a perfectly fine file"))
	eventually(t, 15*time.Second, "the sha256 tag", func() bool {
		r := n.s3(c, "GET", objPath("demo", "uploads/ok.txt")+"?tagging", nil)
		return r.status == 200 && strings.Contains(string(r.body), "<Key>sha256</Key><Value>"+want+"</Value>")
	})
	// the marker is rejected by the before pipeline
	r := n.s3(c, "PUT", objPath("demo", "uploads/bad.txt"), []byte("this has EICAR-TEST-MARKER inside"))
	if r.status != 422 || r.code() != "PipelineRejected" || !strings.Contains(r.message(), "content scan failed: marker found") {
		t.Fatalf("marker upload: %d %s %s\nservice log:\n%s", r.status, r.code(), r.message(), svcLog.String())
	}
	n.must(c, 404, "GET", objPath("demo", "uploads/bad.txt"), nil)
	// keys outside uploads/ are not in the pipelines' scope
	n.must(c, 200, "PUT", objPath("demo", "other/x.txt"), []byte("EICAR-TEST-MARKER but out of scope"))
	n.waitRunState("pipeline=tag-hash&key=uploads/ok.txt", "succeeded")
}

func sha256hex(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }
