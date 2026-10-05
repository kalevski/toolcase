package app_test

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// A bucket that is frozen for a move refuses every write with 503 SlowDown and
// Retry-After: 1, and keeps serving reads; paused, it refuses reads too.
func TestFrozenBucketOverHTTP(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	n.bucket("other", nil)
	oc := n.token("other", all, nil)
	n.must(c, 200, "PUT", "/bkt/a", []byte("one"))
	g := n.app.Eng.Gate

	if err := g.Freeze(context.Background(), "bkt"); err != nil {
		t.Fatal(err)
	}
	for name, req := range map[string][3]string{
		"put":       {"PUT", "/bkt/b", "two"},
		"delete":    {"DELETE", "/bkt/a", ""},
		"multipart": {"POST", "/bkt/m?uploads", ""},
		"tagging":   {"PUT", "/bkt/a?tagging", "<Tagging><TagSet></TagSet></Tagging>"},
	} {
		r := n.s3(c, req[0], req[1], []byte(req[2]))
		if r.status != 503 || r.code() != "SlowDown" || r.header.Get("Retry-After") != "1" {
			t.Fatalf("%s on a frozen bucket: %d %s %v", name, r.status, r.code(), r.header)
		}
	}
	if r := n.must(c, 200, "GET", "/bkt/a", nil); string(r.body) != "one" {
		t.Fatalf("read while frozen: %q", r.body)
	}
	n.must(c, 200, "GET", "/bkt?list-type=2", nil)
	n.must(oc, 200, "PUT", "/other/x", []byte("unaffected")) // another bucket is not affected

	g.Pause("bkt")
	if r := n.s3(c, "GET", "/bkt/a", nil); r.status != 503 || r.code() != "SlowDown" {
		t.Fatalf("read of a paused bucket: %d %s", r.status, r.code())
	}
	g.Thaw("bkt")
	n.must(c, 200, "PUT", "/bkt/b", []byte("two"))
	if r := n.must(c, 200, "GET", "/bkt/a", nil); string(r.body) != "one" {
		t.Fatalf("the object written before the freeze: %q", r.body)
	}
}

// gatedBody sends its first part at once and the rest when released.
type gatedBody struct {
	first, rest string
	gate        chan struct{}
	pos         int
}

func (b *gatedBody) Read(p []byte) (int, error) {
	if b.pos == 0 {
		b.pos = len(b.first)
		return copy(p, b.first), nil
	}
	if b.pos == len(b.first) {
		<-b.gate
		b.pos += len(b.rest)
		return copy(p, b.rest), nil
	}
	return 0, io.EOF
}

// An upload that is still sending its body when the bucket freezes is ended with
// the same 503, and leaves nothing behind.
func TestFreezeEndsAnUploadInFlight(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	body := &gatedBody{first: "first half ", rest: "second half", gate: make(chan struct{})}
	req, _ := http.NewRequest("PUT", n.s3URL+"/bkt/big", body)
	req.ContentLength = int64(len(body.first) + len(body.rest))
	if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), "UNSIGNED-PAYLOAD"); err != nil {
		t.Fatal(err)
	}
	got := make(chan *resp, 1)
	go func() {
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			got <- &resp{status: -1, body: []byte(err.Error())}
			return
		}
		defer res.Body.Close()
		raw, _ := io.ReadAll(res.Body)
		got <- &resp{res.StatusCode, res.Header, raw}
	}()
	time.Sleep(300 * time.Millisecond) // the server has the first half
	if err := n.app.Eng.Gate.Freeze(context.Background(), "bkt"); err != nil {
		t.Fatal(err)
	}
	close(body.gate)
	r := <-got
	if r.status != 503 || !strings.Contains(string(r.body), "SlowDown") {
		t.Fatalf("an upload in flight at the freeze: %d %s", r.status, r.body)
	}
	n.app.Eng.Gate.Thaw("bkt")
	n.must(c, 404, "GET", "/bkt/big", nil)
}
