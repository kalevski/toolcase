package sdkgo

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"
)

// bucketInfo is a bucket and the credentials of its token.
type bucketInfo struct {
	Name      string         `json:"name"`
	AccessKey string         `json:"access_key"`
	SecretKey string         `json:"secret_key"`
	Settings  map[string]any `json:"settings"`
}

// environment is env.json as written by support/bootstrap.py.
type environment struct {
	Endpoint   string                `json:"endpoint"`
	Domain     string                `json:"domain"`
	Region     string                `json:"region"`
	AdminURL   string                `json:"admin_url"`
	AdminToken string                `json:"admin_token"`
	QuotaBytes int64                 `json:"quota_bytes"`
	Buckets    map[string]bucketInfo `json:"buckets"`
}

var env *environment

func TestMain(m *testing.M) {
	if p := os.Getenv("BV_ENV_JSON"); p != "" {
		raw, err := os.ReadFile(p)
		if err != nil {
			fmt.Fprintln(os.Stderr, "cannot read BV_ENV_JSON:", err)
			os.Exit(2)
		}
		env = &environment{}
		if err := json.Unmarshal(raw, env); err != nil {
			fmt.Fprintln(os.Stderr, "cannot parse BV_ENV_JSON:", err)
			os.Exit(2)
		}
	}
	os.Exit(m.Run())
}

// needEnv skips the test when the harness environment is absent (go test run by hand).
func needEnv(t testing.TB) *environment {
	t.Helper()
	if env == nil {
		t.Skip("BV_ENV_JSON is not set; run through test/conformance/run.sh")
	}
	return env
}

var adminHTTP = &http.Client{Timeout: 60 * time.Second}

// admin calls the admin API; it returns the HTTP status and the raw body.
func (e *environment) admin(method, path string, body any) (int, []byte, error) {
	var rd io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		rd = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, e.AdminURL+"/_admin/v1"+path, rd)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+e.AdminToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := adminHTTP.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	return resp.StatusCode, raw, err
}

func (e *environment) adminJSON(t testing.TB, method, path string, body any, want int) map[string]any {
	t.Helper()
	status, raw, err := e.admin(method, path, body)
	if err != nil {
		t.Fatalf("admin %s %s: %v", method, path, err)
	}
	if status != want {
		t.Fatalf("admin %s %s: HTTP %d (want %d): %s", method, path, status, want, raw)
	}
	out := map[string]any{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return out
}

var fullGrant = []any{map[string]any{"actions": []string{"read", "write", "list", "delete", "purge", "tag"}}}

var nonName = regexp.MustCompile(`[^a-z0-9-]`)

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// newBucket creates an isolated bucket with the given admin-API settings and one full-access token.
func (e *environment) newBucket(t testing.TB, tag string, settings map[string]any) bucketInfo {
	t.Helper()
	tag = nonName.ReplaceAllString(strings.ToLower(tag), "")
	if len(tag) > 20 {
		tag = tag[:20]
	}
	name := fmt.Sprintf("bvt-go-%s-%s", tag, randHex(5))
	body := map[string]any{"name": name}
	for k, v := range settings {
		body[k] = v
	}
	e.adminJSON(t, "POST", "/buckets", body, http.StatusCreated)
	tok := e.adminJSON(t, "POST", "/buckets/"+name+"/tokens", map[string]any{"name": "go", "grants": fullGrant}, http.StatusCreated)
	return bucketInfo{Name: name, AccessKey: tok["access_key_id"].(string), SecretKey: tok["secret_access_key"].(string), Settings: settings}
}

// newToken mints another token on a bucket and returns its credentials as a bucketInfo.
func (e *environment) newToken(t testing.TB, bucket string, grants []any, extra map[string]any) bucketInfo {
	t.Helper()
	body := map[string]any{"name": "go-extra", "grants": grants}
	for k, v := range extra {
		body[k] = v
	}
	tok := e.adminJSON(t, "POST", "/buckets/"+bucket+"/tokens", body, http.StatusCreated)
	return bucketInfo{Name: bucket, AccessKey: tok["access_key_id"].(string), SecretKey: tok["secret_access_key"].(string)}
}

// bucketStats reads the admin-API counters of a bucket (objects, versions, bytes, upload_bytes).
func (e *environment) bucketStats(t testing.TB, bucket string) map[string]float64 {
	t.Helper()
	b := e.adminJSON(t, "GET", "/buckets/"+bucket, nil, http.StatusOK)
	out := map[string]float64{}
	if st, ok := b["stats"].(map[string]any); ok {
		for k, v := range st {
			if f, ok := v.(float64); ok {
				out[k] = f
			}
		}
	}
	return out
}
