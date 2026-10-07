package config

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var goodKey = base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789ABCDEF"))

func minimal() map[string]string {
	return map[string]string{
		"WEBMAIL_PUBLIC_URL": "https://mail.example.test", "WEBMAIL_JMAP_URL": "http://jmap.internal:8080",
		"WEBMAIL_PLATFORM_URL": "https://platform.example.test", "WEBMAIL_PLATFORM_TOKEN": "tok", "WEBMAIL_SESSION_KEY": goodKey,
	}
}

func loadEnv(m map[string]string) (*Config, []string, error) {
	var environ []string
	for k, v := range m {
		environ = append(environ, k+"="+v)
	}
	return LoadFromEnviron(environ)
}

func TestDefaults(t *testing.T) {
	c, _, err := loadEnv(minimal())
	if err != nil {
		t.Fatal(err)
	}
	if c.Listen != ":8080" || c.AdminListen != "127.0.0.1:8081" || c.DataDir != "/var/lib/webmail" || c.SessionIdle != 12*time.Hour ||
		c.SessionMax != 720*time.Hour || c.MaxUploadMB != 25 || c.IPFailLimit != 20 || c.BrandingTTL != 60*time.Second ||
		c.LogFormat != "logfmt" || c.LogLevel != "info" || !c.Secure() || len(c.SessionKey) != 32 {
		t.Fatalf("%+v", c)
	}
}

func TestCollectsAllProblems(t *testing.T) {
	_, _, err := loadEnv(map[string]string{"WEBMAIL_LISTEN": "nope", "WEBMAIL_SESSION_KEY": "short", "WEBMAIL_MAX_UPLOAD_MB": "x"})
	e, ok := err.(*Error)
	if !ok {
		t.Fatalf("%v", err)
	}
	got := e.Error()
	for _, v := range []string{"WEBMAIL_LISTEN", "WEBMAIL_PUBLIC_URL: is required", "WEBMAIL_JMAP_URL: is required", "WEBMAIL_PLATFORM_URL: is required",
		"WEBMAIL_PLATFORM_TOKEN: is required", "WEBMAIL_SESSION_KEY", "WEBMAIL_MAX_UPLOAD_MB"} {
		if !strings.Contains(got, v) {
			t.Errorf("missing %q in:\n%s", v, got)
		}
	}
}

func TestSessionKeyLength(t *testing.T) {
	m := minimal()
	m["WEBMAIL_SESSION_KEY"] = base64.StdEncoding.EncodeToString(make([]byte, 16))
	if _, _, err := loadEnv(m); err == nil || !strings.Contains(err.Error(), "16 bytes") {
		t.Fatalf("%v", err)
	}
	if strings.Contains(err2(m), base64.StdEncoding.EncodeToString(make([]byte, 16))) {
		t.Fatal("secret echoed")
	}
}

func err2(m map[string]string) string {
	_, _, err := loadEnv(m)
	if err == nil {
		return ""
	}
	return err.Error()
}

func TestFileSecrets(t *testing.T) {
	dir := t.TempDir()
	kf := filepath.Join(dir, "key")
	os.WriteFile(kf, []byte(goodKey+"\n"), 0o600)
	tf := filepath.Join(dir, "tok")
	os.WriteFile(tf, []byte("file-token\n"), 0o600)
	m := minimal()
	delete(m, "WEBMAIL_SESSION_KEY")
	delete(m, "WEBMAIL_PLATFORM_TOKEN")
	m["WEBMAIL_SESSION_KEY_FILE"] = kf
	m["WEBMAIL_PLATFORM_TOKEN_FILE"] = tf
	c, _, err := loadEnv(m)
	if err != nil || c.PlatformToken != "file-token" || len(c.SessionKey) != 32 {
		t.Fatalf("%v %+v", err, c)
	}
	m["WEBMAIL_SESSION_KEY"] = goodKey
	if _, _, err := loadEnv(m); err == nil || !strings.Contains(err.Error(), "only one") {
		t.Fatalf("both forms: %v", err)
	}
	m = minimal()
	m["WEBMAIL_PLATFORM_TOKEN_FILE"] = filepath.Join(dir, "missing")
	delete(m, "WEBMAIL_PLATFORM_TOKEN")
	if _, _, err := loadEnv(m); err == nil {
		t.Fatal("missing file accepted")
	}
}

func TestUnknownVariablesWarn(t *testing.T) {
	m := minimal()
	m["WEBMAIL_LISTN"] = ":1"
	m["WEBMAIL_FROBNICATE"] = "1"
	m["WEBMAIL_PUBLIC_URL_FILE"] = "/x"
	m["webmail_listen"] = ":2"
	_, w, err := loadEnv(m)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(w, "\n")
	for _, want := range []string{"WEBMAIL_LISTN: unknown variable, ignored (did you mean WEBMAIL_LISTEN?)", "WEBMAIL_FROBNICATE: unknown variable, ignored", "WEBMAIL_PUBLIC_URL_FILE", "webmail_listen"} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing %q in\n%s", want, joined)
		}
	}
}

func TestAppliedMasksSecrets(t *testing.T) {
	c, _, _ := loadEnv(minimal())
	all := strings.Join(c.Applied(), "\n")
	if strings.Contains(all, goodKey) || strings.Contains(all, "=tok") || !strings.Contains(all, "WEBMAIL_SESSION_KEY=***") || !strings.Contains(all, "WEBMAIL_PLATFORM_TOKEN=***") {
		t.Fatalf("%s", all)
	}
}

func TestValidation(t *testing.T) {
	cases := map[string]string{
		"WEBMAIL_PUBLIC_URL":      "https://x.test/path",
		"WEBMAIL_JMAP_URL":        "ftp://x",
		"WEBMAIL_SESSION_IDLE":    "never",
		"WEBMAIL_TRUSTED_PROXIES": "10.0.0.0/8,,bogus",
		"WEBMAIL_LOG_LEVEL":       "loud",
		"WEBMAIL_LOG_FORMAT":      "xml",
		"WEBMAIL_BRANDING_TTL":    "0s",
		"WEBMAIL_LISTEN":          "",
	}
	for k, v := range cases {
		m := minimal()
		m[k] = v
		if _, _, err := loadEnv(m); err == nil || !strings.Contains(err.Error(), k) {
			t.Errorf("%s=%q: %v", k, v, err)
		}
	}
	m := minimal()
	m["WEBMAIL_SESSION_IDLE"] = "800h"
	if _, _, err := loadEnv(m); err == nil {
		t.Error("idle > max accepted")
	}
	m = minimal()
	m["WEBMAIL_TRUSTED_PROXIES"] = "10.0.0.0/8, 192.168.1.1"
	c, _, err := loadEnv(m)
	if err != nil || len(c.TrustedProxies) != 2 {
		t.Fatalf("%v", err)
	}
}

func TestWarnings(t *testing.T) {
	m := minimal()
	m["WEBMAIL_PUBLIC_URL"] = "http://localhost:8080"
	m["WEBMAIL_ADMIN_LISTEN"] = "0.0.0.0:8081"
	_, w, err := loadEnv(m)
	if err != nil || len(w) != 2 {
		t.Fatalf("%v %v", err, w)
	}
}

func TestPlaceholderSessionKeyRefusedWhenSecure(t *testing.T) {
	m := minimal()
	m["WEBMAIL_SESSION_KEY"] = base64.StdEncoding.EncodeToString(make([]byte, 32))
	if _, _, err := loadEnv(m); err == nil || !strings.Contains(err.Error(), "placeholder") {
		t.Fatalf("%v", err)
	}
	m["WEBMAIL_SESSION_KEY"] = base64.StdEncoding.EncodeToString([]byte(strings.Repeat("A", 32)))
	if _, _, err := loadEnv(m); err == nil || !strings.Contains(err.Error(), "placeholder") {
		t.Fatalf("%v", err)
	}
	m["WEBMAIL_PUBLIC_URL"] = "http://localhost:8080"
	if _, _, err := loadEnv(m); err != nil {
		t.Fatalf("dev (http) must still accept it: %v", err)
	}
}
