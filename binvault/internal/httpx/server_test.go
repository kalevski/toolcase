package httpx

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type lockedBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (l *lockedBuffer) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}

func (l *lockedBuffer) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.String()
}

func selfSigned(t *testing.T) (certFile, keyFile string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "localhost"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	kb, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	certFile, keyFile = filepath.Join(dir, "c.pem"), filepath.Join(dir, "k.pem")
	if err := os.WriteFile(certFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: kb}), 0o600); err != nil {
		t.Fatal(err)
	}
	return certFile, keyFile
}

// What net/http reports about a connection (a failed TLS handshake) must go
// through the process logger: with BINVAULT_LOG_FORMAT=json every line is JSON
// (spec §2.3, §9.1), not the standard library's own line format.
func TestServerErrorsGoThroughTheProcessLogger(t *testing.T) {
	cert, key := selfSigned(t)
	var logs lockedBuffer
	srv, err := NewServer(ServerConfig{
		Name: "public", Addr: "127.0.0.1:0", Handler: http.NotFoundHandler(), HeaderTimeout: time.Second,
		TLSCertFile: cert, TLSKeyFile: key, Log: slog.New(slog.NewJSONHandler(&logs, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	go srv.Serve()
	defer srv.Close()
	conn, err := net.Dial("tcp", srv.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	conn.Write([]byte("\x16\x03\x01garbage that is not a TLS hello"))
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn.Read(make([]byte, 64))
	conn.Close()
	deadline := time.Now().Add(3 * time.Second)
	for !strings.Contains(logs.String(), "TLS handshake error") && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	out := logs.String()
	if !strings.Contains(out, "TLS handshake error") {
		t.Fatalf("the handshake error was not logged through the process logger: %q", out)
	}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("not a JSON line: %q (%v)", line, err)
		}
		if strings.Contains(line, "TLS handshake error") && (m["level"] != "WARN" || m["listener"] != "public") {
			t.Fatalf("level/listener of the handshake error: %q", line)
		}
	}
}
