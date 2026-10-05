package app_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

// On SIGTERM the node reports draining, but the S3 listener stays open only while pipeline calls are in
// flight (their services need it for their tokens): then /_healthz answers 503 draining. A node with nothing
// in flight closes its listeners at once, and a load balancer sees the connection refused instead (spec
// §9.3, §9.4).
func TestHealthzDrainsOnlyWhilePipelineCallsAreInFlight(t *testing.T) {
	health := func(url string) (int, string, error) {
		res, err := (&http.Client{Timeout: 2 * time.Second}).Get(url + "/_healthz")
		if err != nil {
			return 0, "", err
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		return res.StatusCode, strings.TrimSpace(string(b)), nil
	}
	start := func() (*node, context.CancelFunc, chan struct{}) {
		cfg := cfgFor(t.TempDir(), key32())
		cfg.MinFreeMB = 1
		cfg.EndpointURL = "http://127.0.0.1:9000"
		cfg.ShutdownTimeout = 20 * time.Second
		ctx, cancel := context.WithCancel(context.Background())
		a, err := app.New(ctx, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), app.Build{Version: "test"})
		if err != nil {
			cancel()
			t.Fatal(err)
		}
		done := make(chan struct{})
		go func() { _ = a.Run(ctx); close(done) }()
		t.Cleanup(func() { cancel(); <-done })
		return &node{t: t, app: a, s3URL: "http://" + a.PublicAddr(), adminURL: "http://" + a.AdminAddr(), adminTok: cfg.AdminToken[0]}, cancel, done
	}

	// idle: nothing answers once the node has been told to stop
	idle, stopIdle, idleDone := start()
	if code, body, err := health(idle.s3URL); err != nil || code != 200 {
		t.Fatalf("%d %q %v", code, body, err)
	}
	stopIdle()
	select {
	case <-idleDone:
	case <-time.After(10 * time.Second):
		t.Fatal("an idle node did not stop")
	}
	if code, body, err := health(idle.s3URL); err == nil {
		t.Fatalf("an idle node that was told to stop still answers: %d %q", code, body)
	}

	// a pipeline call in flight keeps the listener open, and the answer is 503 draining
	n, stop, done := start()
	svc := newFsvc(t)
	entered, release := make(chan struct{}, 1), make(chan struct{})
	svc.on["slow"] = func(*fcall) int {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-release
		return 204
	}
	n.bucket("draining", nil)
	n.mustAdmin(201, "POST", "/pipelines", pipeDef("slow", "after", svc.url("slow"), n.s3URL, nil))
	n.mustAdmin(200, "PUT", "/buckets/draining/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "slow", "enabled": true}}})
	n.must(n.token("draining", all, nil), 200, "PUT", "/draining/k", []byte("v"))
	select {
	case <-entered:
	case <-time.After(10 * time.Second):
		t.Fatal("the pipeline service was never called")
	}
	stop()
	deadline := time.Now().Add(5 * time.Second)
	for {
		code, body, err := health(n.s3URL)
		if err == nil && code == 503 && body == "draining" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("with a pipeline call in flight /_healthz answered %d %q %v, want 503 draining", code, body, err)
		}
		time.Sleep(20 * time.Millisecond)
	}
	close(release)
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("the node did not stop once its pipeline call ended")
	}
}
