package app_test

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// DeleteObjects answers 200 with a verdict per key. A key whose delete was cut short because the
// bucket froze for a move is a SlowDown to retry (as the same delete on its own would be), not an
// internal error; the keys reported deleted are gone and the others are still there.
func TestClusterDeleteObjectsAcrossTheFreezeReportsSlowDown(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a := tc.nodes[0]
	cr := seedBucket(t, a, "delobj", "a", 0)
	const n = 400
	var keys []string
	for i := 0; i < n; i++ {
		keys = append(keys, fmt.Sprintf("k%04d", i))
	}
	var wg sync.WaitGroup
	sem := make(chan struct{}, 16)
	for _, k := range keys {
		wg.Add(1)
		sem <- struct{}{}
		go func(k string) {
			defer wg.Done()
			defer func() { <-sem }()
			a.s3(cr, "PUT", "/delobj/"+k, []byte("v"))
		}(k)
	}
	wg.Wait()
	var body bytes.Buffer
	body.WriteString("<Delete>")
	for _, k := range keys {
		body.WriteString("<Object><Key>" + k + "</Key></Object>")
	}
	body.WriteString("</Delete>")
	sum := md5.Sum(body.Bytes())
	// every delete takes a millisecond inside its transaction, so that the request is still
	// running when the freeze comes
	orig := a.app.Eng.Hooks.Outbox
	a.app.Eng.Hooks.Outbox = func(ctx context.Context, tx *meta.Tx, ev *engine.Event) error {
		time.Sleep(time.Millisecond)
		return orig(ctx, tx, ev)
	}
	var res *resp
	done := make(chan struct{})
	go func() {
		defer close(done)
		res = a.s3(cr, "POST", "/delobj?delete", body.Bytes(), "Content-MD5", base64.StdEncoding.EncodeToString(sum[:]))
	}()
	time.Sleep(200 * time.Millisecond)
	if err := a.app.Eng.Gate.Freeze(context.Background(), "delobj"); err != nil {
		t.Fatal(err)
	}
	<-done
	a.app.Eng.Gate.Thaw("delobj")

	var out struct {
		Deleted []struct{ Key string }       `xml:"Deleted"`
		Errors  []struct{ Key, Code string } `xml:"Error"`
	}
	if res.status != 200 || xml.Unmarshal(res.body, &out) != nil {
		t.Fatalf("DeleteObjects: %d %s", res.status, res.body)
	}
	if len(out.Errors) == 0 {
		t.Fatalf("the freeze came after the request had finished (%d keys deleted): the test did not test anything", len(out.Deleted))
	}
	for _, e := range out.Errors {
		if e.Code != "SlowDown" {
			t.Errorf("key %s was cut short by the freeze and is reported as %q, not SlowDown", e.Key, e.Code)
		}
	}
	told := map[string]bool{}
	for _, d := range out.Deleted {
		told[d.Key] = true
	}
	failed := map[string]bool{}
	for _, e := range out.Errors {
		failed[e.Key] = true
	}
	for _, k := range keys {
		gone := a.s3(cr, "GET", "/delobj/"+k, nil).status == 404
		if told[k] != gone {
			t.Errorf("key %s: reported deleted=%v, gone=%v", k, told[k], gone)
		}
		if !told[k] && !failed[k] {
			t.Errorf("key %s is neither reported deleted nor failed", k)
		}
	}
}
