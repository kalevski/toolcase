package admin

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/admintoken"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// TestSocketNeedsNoTokenButTCPDoes runs the real listeners: the Unix socket
// serves /status without a bearer token (the CLI has only a hash on disk),
// while the TCP port keeps refusing a request without one.
func TestSocketNeedsNoTokenButTCPDoes(t *testing.T) {
	dir, err := os.MkdirTemp("/tmp", "np-sock-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	socket := filepath.Join(dir, "run", "admin.sock")

	cfg := &config.Config{DataDir: t.TempDir()}
	store, err := state.NewStore(cfg.DataDir)
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	hash, _ := admintoken.Parse(admintoken.Sum("0123456789abcdef0123456789abcdef"))
	srv := New(manager.New(cfg, store, log), hash, log, nil)
	srv.Version = "test-1"

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	listen := ln.Addr().String()
	ln.Close()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		_ = srv.Run(ctx, listen, socket)
		close(done)
	}()
	t.Cleanup(func() { cancel(); <-done })

	viaSocket := &http.Client{Timeout: 2 * time.Second, Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", socket)
		},
	}}

	var resp *http.Response
	for i := 0; i < 50; i++ {
		resp, err = viaSocket.Get("http://nginxpilot/status")
		if err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("socket: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("socket /status without a token: want 200, got %d", resp.StatusCode)
	}
	var payload struct {
		Version string `json:"version"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&payload)
	if payload.Version != "test-1" {
		t.Fatalf("/status version: want test-1, got %q", payload.Version)
	}

	info, err := os.Stat(socket)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("socket mode: want 0600, got %v (%v)", info.Mode().Perm(), err)
	}

	tcp, err := http.Get("http://" + listen + "/status")
	if err != nil {
		t.Fatalf("tcp: %v", err)
	}
	tcp.Body.Close()
	if tcp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("tcp /status without a token: want 401, got %d", tcp.StatusCode)
	}

	req, _ := http.NewRequest(http.MethodGet, "http://"+listen+"/status", nil)
	req.Header.Set("Authorization", "Bearer 0123456789abcdef0123456789abcdef")
	authed, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("tcp authed: %v", err)
	}
	authed.Body.Close()
	if authed.StatusCode != http.StatusOK {
		t.Fatalf("tcp /status with the token: want 200, got %d", authed.StatusCode)
	}
}
