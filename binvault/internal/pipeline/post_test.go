package pipeline_test

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// postForm sends a browser-style POST Object upload.
func (n *node) postForm(c cred, bucket, key string, data []byte) *resp {
	n.t.Helper()
	now := time.Now().UTC()
	doc := fmt.Sprintf(`{"expiration":%q,"conditions":[{"bucket":%q},["starts-with","$key","up/"],{"x-amz-algorithm":"AWS4-HMAC-SHA256"},`+
		`["starts-with","$x-amz-credential",""],["starts-with","$x-amz-date",""],{"success_action_status":"201"}]}`,
		now.Add(time.Hour).Format("2006-01-02T15:04:05Z"), bucket)
	policy := base64.StdEncoding.EncodeToString([]byte(doc))
	cr, date, sig := sigv4.SignPostPolicy(policy, c.ak, c.sk, "us-east-1", now)
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for _, kv := range [][2]string{{"key", key}, {"policy", policy}, {"x-amz-algorithm", "AWS4-HMAC-SHA256"},
		{"x-amz-credential", cr}, {"x-amz-date", date}, {"x-amz-signature", sig}, {"success_action_status", "201"}} {
		_ = w.WriteField(kv[0], kv[1])
	}
	fw, _ := w.CreateFormFile("file", "upload.bin")
	_, _ = fw.Write(data)
	_ = w.Close()
	req, _ := http.NewRequest("POST", n.s3URL+"/"+bucket, &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return n.do(req)
}

func TestBeforeOnPostObject(t *testing.T) {
	e := newGate(t, nil, map[string]any{"match": map[string]any{"operations": []string{"post"}}}, nil)
	reject := false
	e.svc.on("gate", func(cl *call) reply {
		if cl.str("operation") != "post" {
			t.Errorf("operation = %s", cl.str("operation"))
		}
		if reject {
			return reply{Status: 422}
		}
		e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("rewritten by the gate"))
		return reply{}
	})
	r := e.n.postForm(e.c, "bkt", "up/a.txt", []byte("browser upload"))
	if r.status != 201 {
		t.Fatalf("POST Object: %d %s %s", r.status, r.code(), r.message())
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "up/a.txt"), nil); string(got.body) != "rewritten by the gate" {
		t.Fatalf("committed %q", got.body)
	}
	reject = true
	if r := e.n.postForm(e.c, "bkt", "up/b.txt", []byte("x")); r.status != 422 || !strings.Contains(string(r.body), "PipelineRejected") {
		t.Fatalf("rejected POST: %d %s", r.status, r.body)
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "up/b.txt"), nil)
	// a PUT is not a post: the gate does not match it
	calls := len(e.svc.callsOf("gate"))
	e.n.must(e.c, 200, "PUT", objPath("bkt", "put/c"), []byte("x"))
	if len(e.svc.callsOf("gate")) != calls {
		t.Fatal("operations [post] must not match a put")
	}
}
