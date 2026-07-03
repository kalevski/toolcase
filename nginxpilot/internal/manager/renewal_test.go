package manager

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"log/slog"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/acme"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// writeExpiringCert writes a self-signed cert (expiring at notAfter) + key
// placeholder at the given paths.
func writeExpiringCert(t *testing.T, certPath, keyPath, cn string, notAfter time.Time) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(certPath), 0o755); err != nil {
		t.Fatal(err)
	}
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: cn},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     notAfter,
		DNSNames:     []string{cn},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, []byte("k"), 0o600); err != nil {
		t.Fatal(err)
	}
}

type certbotCall struct {
	args []string
}

// renewalTestManager builds a Manager whose acme client records certbot argv
// instead of running it. The cert layout under dir:
//
//	live/due.example.com/       expiring in 12h  → certbot-managed, due
//	live/fresh.example.com/     expiring in 60d  → not due
//	manual.example.com.crt/.key expiring in 12h  → manual flat, due (warn only)
func renewalTestManager(t *testing.T, renewErr map[string]bool) (*Manager, *[]certbotCall) {
	t.Helper()
	dir := t.TempDir()
	live := filepath.Join(dir, "live")
	writeExpiringCert(t, filepath.Join(live, "due.example.com", "fullchain.pem"),
		filepath.Join(live, "due.example.com", "privkey.pem"), "due.example.com", time.Now().Add(12*time.Hour))
	writeExpiringCert(t, filepath.Join(live, "fresh.example.com", "fullchain.pem"),
		filepath.Join(live, "fresh.example.com", "privkey.pem"), "fresh.example.com", time.Now().Add(60*24*time.Hour))
	writeExpiringCert(t, filepath.Join(live, "manual.example.com.crt"),
		filepath.Join(live, "manual.example.com.key"), "manual.example.com", time.Now().Add(12*time.Hour))

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	cfg := &config.Config{
		DataDir: dir,
		Tls:     config.Tls{CertDir: live},
		Acme: config.Acme{
			Enabled: true, Email: "a@b.c", AgreeTOS: true,
			Challenge: config.ChallengeHTTP,
			HTTP:      config.AcmeHTTP{Webroot: "/tmp"},
			ConfigDir: dir, // live/ sits under it, matching certbot's layout
		},
	}

	var mu sync.Mutex
	calls := &[]certbotCall{}
	run := func(_ context.Context, _ []string, _ string, args ...string) (string, error) {
		mu.Lock()
		*calls = append(*calls, certbotCall{args: args})
		mu.Unlock()
		for name, fail := range renewErr {
			if fail && indexOf(args, name) >= 0 {
				return "simulated failure", os.ErrDeadlineExceeded
			}
		}
		return "renewed", nil
	}

	m := &Manager{
		log:     logger,
		cfg:     cfg,
		certDir: live,
		acme:    acme.NewWithRun(cfg.Acme, nil, dir, logger, run),
	}
	return m, calls
}

func indexOf(s []string, v string) int {
	for i, x := range s {
		if x == v {
			return i
		}
	}
	return -1
}

func TestRenewDueOnce(t *testing.T) {
	m, calls := renewalTestManager(t, nil)
	m.renewDueOnce(context.Background(), 24*time.Hour)

	// Exactly one certbot invocation: the due certbot-managed cert. Manual and
	// fresh certs produce none.
	if len(*calls) != 1 {
		t.Fatalf("expected 1 certbot call, got %d: %v", len(*calls), *calls)
	}
	args := (*calls)[0].args
	joined := strings.Join(args, " ")
	for _, want := range []string{"renew", "--cert-name due.example.com", "--force-renewal", "--no-random-sleep-on-renew"} {
		if !strings.Contains(joined, want) {
			t.Errorf("argv missing %q: %v", want, args)
		}
	}

	st := m.RenewalStatus()
	if s, ok := st.States["due.example.com"]; !ok || s.LastSuccess.IsZero() || s.LastError != "" {
		t.Errorf("due cert state wrong: %+v", s)
	}
	if s, ok := st.States["manual.example.com"]; !ok || !s.Manual {
		t.Errorf("manual cert should be recorded manual-only: %+v", s)
	}
	if _, ok := st.States["fresh.example.com"]; ok {
		t.Error("fresh cert should not be touched")
	}
}

func TestRenewDueOnceContinuesPastFailures(t *testing.T) {
	// A second due managed cert whose renew fails: the batch must continue.
	m, calls := renewalTestManager(t, map[string]bool{"broken.example.com": true})
	writeExpiringCert(t, filepath.Join(m.certDir, "broken.example.com", "fullchain.pem"),
		filepath.Join(m.certDir, "broken.example.com", "privkey.pem"), "broken.example.com", time.Now().Add(6*time.Hour))

	m.renewDueOnce(context.Background(), 24*time.Hour)

	if len(*calls) != 2 {
		t.Fatalf("expected 2 certbot calls (broken + due), got %d", len(*calls))
	}
	st := m.RenewalStatus()
	if s := st.States["broken.example.com"]; s.LastError == "" {
		t.Errorf("failed renew must record LastError: %+v", s)
	}
	if s := st.States["due.example.com"]; s.LastError != "" || s.LastSuccess.IsZero() {
		t.Errorf("one failure must not starve the rest: %+v", s)
	}
}

func TestRenewalLoopTicksAndStops(t *testing.T) {
	m, calls := renewalTestManager(t, nil)
	m.cfg.Acme.Renewal = config.AcmeRenewal{CheckInterval: config.Duration(config.MinRenewalCheckInterval)}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		m.runRenewalLoop(ctx)
		close(done)
	}()

	// The loop parks on the 30s startup timer / 1m ticker; drive a tick
	// directly to keep the test fast, then verify clean shutdown.
	m.renewDueOnce(ctx, 24*time.Hour)
	if len(*calls) == 0 {
		t.Error("tick should have renewed the due cert")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("loop did not stop on ctx cancel")
	}
}
