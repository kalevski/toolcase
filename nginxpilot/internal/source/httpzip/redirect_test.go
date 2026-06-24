package httpzip

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// buildZip returns a minimal valid zip archive.
func buildZip(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	f, err := w.Create("index.html")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write([]byte("<html></html>")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// TestCheckRedirectStripsCustomHeaderOnCrossHostRedirect verifies that a
// cross-host redirect does not forward the custom auth header (X-Api-Key) to
// the second host.
func TestCheckRedirectStripsCustomHeaderOnCrossHostRedirect(t *testing.T) {
	const headerName = "X-Api-Key"
	const headerValue = "super-secret"

	zipBody := buildZip(t)
	receivedOnB := make(chan string, 1)

	// Server B: the redirect target — records the custom header value.
	serverB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedOnB <- r.Header.Get(headerName)
		w.Header().Set("Content-Type", "application/zip")
		w.WriteHeader(http.StatusOK)
		w.Write(zipBody)
	}))
	defer serverB.Close()

	// Server A: responds with a redirect to server B (different host:port).
	serverA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, serverB.URL+"/artifact.zip", http.StatusFound)
	}))
	defer serverA.Close()

	src := config.Source{
		Type: config.SourceHTTPZip,
		URL:  serverA.URL + "/artifact.zip",
		Auth: config.Auth{
			Method:   config.AuthHeader,
			Name:     headerName,
			ValueEnv: "HTTPZIP_TEST_XHDR",
		},
	}
	t.Setenv("HTTPZIP_TEST_XHDR", headerValue)

	syncer := New("test.example.com", src, t.TempDir(), slog.Default())

	_, err := syncer.Sync(context.Background(), &state.SiteState{}, t.TempDir())
	if err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}

	got := <-receivedOnB
	if got != "" {
		t.Errorf("custom header %q leaked to redirect target; got %q", headerName, got)
	}
}

// TestCheckRedirectPreservesCustomHeaderOnSameHostRedirect verifies that a
// same-host redirect (same host:port) keeps the custom auth header.
func TestCheckRedirectPreservesCustomHeaderOnSameHostRedirect(t *testing.T) {
	const headerName = "X-Api-Key"
	const headerValue = "super-secret"

	zipBody := buildZip(t)
	receivedOnFinal := make(chan string, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/real.zip", func(w http.ResponseWriter, r *http.Request) {
		receivedOnFinal <- r.Header.Get(headerName)
		w.Header().Set("Content-Type", "application/zip")
		w.WriteHeader(http.StatusOK)
		w.Write(zipBody)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	// Register the redirect handler after the server URL is known so the
	// redirect target URL uses the real port.
	mux.HandleFunc("/artifact.zip", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, server.URL+"/real.zip", http.StatusFound)
	})

	src := config.Source{
		Type: config.SourceHTTPZip,
		URL:  server.URL + "/artifact.zip",
		Auth: config.Auth{
			Method:   config.AuthHeader,
			Name:     headerName,
			ValueEnv: "HTTPZIP_TEST_XHDR_SAME",
		},
	}
	t.Setenv("HTTPZIP_TEST_XHDR_SAME", headerValue)

	syncer := New("test.example.com", src, t.TempDir(), slog.Default())

	_, err := syncer.Sync(context.Background(), &state.SiteState{}, t.TempDir())
	if err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}

	got := <-receivedOnFinal
	if got != headerValue {
		t.Errorf("custom header should be preserved on same-host redirect; got %q, want %q", got, headerValue)
	}
}

// TestVerifyChecksumSkipsAuthOnDifferentHost verifies that auth credentials
// are not sent to a checksum server whose host differs from the artifact host.
func TestVerifyChecksumSkipsAuthOnDifferentHost(t *testing.T) {
	const headerName = "X-Api-Key"
	const headerValue = "super-secret"

	zipBody := buildZip(t)
	h := sha256.Sum256(zipBody)
	zipHash := hex.EncodeToString(h[:])

	checksumHeaderReceived := make(chan string, 1)

	// Artifact server: returns the zip.
	artifactServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		w.Write(zipBody)
	}))
	defer artifactServer.Close()

	// Checksum server: different host:port — records the auth header value.
	checksumServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checksumHeaderReceived <- r.Header.Get(headerName)
		w.Write([]byte(zipHash + "  artifact.zip\n"))
	}))
	defer checksumServer.Close()

	src := config.Source{
		Type:        config.SourceHTTPZip,
		URL:         artifactServer.URL + "/artifact.zip",
		ChecksumURL: checksumServer.URL + "/artifact.zip.sha256",
		Auth: config.Auth{
			Method:   config.AuthHeader,
			Name:     headerName,
			ValueEnv: "HTTPZIP_TEST_XHDR_CKSUM",
		},
	}
	t.Setenv("HTTPZIP_TEST_XHDR_CKSUM", headerValue)

	syncer := New("test.example.com", src, t.TempDir(), slog.Default())

	_, err := syncer.Sync(context.Background(), &state.SiteState{}, t.TempDir())
	if err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}

	got := <-checksumHeaderReceived
	if got != "" {
		t.Errorf("auth header %q was sent to cross-host checksum server; got %q", headerName, got)
	}
}

// TestVerifyChecksumSendsAuthOnSameHost verifies that auth credentials ARE
// forwarded to a checksum server that shares the artifact host.
func TestVerifyChecksumSendsAuthOnSameHost(t *testing.T) {
	const headerName = "X-Api-Key"
	const headerValue = "super-secret"

	zipBody := buildZip(t)
	h := sha256.Sum256(zipBody)
	zipHash := hex.EncodeToString(h[:])

	checksumHeaderReceived := make(chan string, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/artifact.zip", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		w.Write(zipBody)
	})
	mux.HandleFunc("/artifact.zip.sha256", func(w http.ResponseWriter, r *http.Request) {
		checksumHeaderReceived <- r.Header.Get(headerName)
		w.Write([]byte(zipHash + "  artifact.zip\n"))
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	src := config.Source{
		Type:        config.SourceHTTPZip,
		URL:         server.URL + "/artifact.zip",
		ChecksumURL: server.URL + "/artifact.zip.sha256",
		Auth: config.Auth{
			Method:   config.AuthHeader,
			Name:     headerName,
			ValueEnv: "HTTPZIP_TEST_XHDR_CKSUM_SAME",
		},
	}
	t.Setenv("HTTPZIP_TEST_XHDR_CKSUM_SAME", headerValue)

	syncer := New("test.example.com", src, t.TempDir(), slog.Default())

	_, err := syncer.Sync(context.Background(), &state.SiteState{}, t.TempDir())
	if err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}

	got := <-checksumHeaderReceived
	if got != headerValue {
		t.Errorf("auth header should be sent to same-host checksum server; got %q, want %q", got, headerValue)
	}
}
