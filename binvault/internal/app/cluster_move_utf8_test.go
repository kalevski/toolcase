package app_test

import (
	"testing"
	"time"
)

// A content header the client sent with a byte that is not valid UTF-8 (a Latin-1
// Content-Disposition filename, say) is stored as it came and read back as it was. The rows of
// such a bucket must travel like any other: the bucket moves, and the header is the same on the
// new home.
func TestClusterMoveOfABucketWithANonUTF8HeaderValue(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	cr := seedBucket(t, a, "utf8bkt", "a", 3)
	const disp = "attachment; filename=\"caf\xe9.png\""
	a.must(cr, 200, "PUT", "/utf8bkt/latin1", []byte("x"), "Content-Disposition", disp)
	if got := a.s3(cr, "HEAD", "/utf8bkt/latin1", nil).header.Get("Content-Disposition"); got != disp {
		t.Fatalf("the header is stored as %q, not as sent (%q): this test needs a server that keeps the bytes", got, disp)
	}

	id := startMove(t, a, "utf8bkt", "b", nil)
	if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("a bucket with a non-UTF-8 header value cannot be moved: %v", mv["error"])
	}
	servesAgain(t, tc, cr, "utf8bkt")
	if h, _ := bucketHome(t, a, "utf8bkt"); h != "b" {
		t.Fatalf("the bucket is homed on %s", h)
	}
	for _, n := range []*cnode{a, b} {
		r := n.s3(cr, "HEAD", "/utf8bkt/latin1", nil)
		if r.status != 200 || r.header.Get("Content-Disposition") != disp {
			t.Fatalf("via %s after the move: %d, Content-Disposition %q, want %q", n.name, r.status, r.header.Get("Content-Disposition"), disp)
		}
	}
	tc.noAlarms()
}

// The drain of a node that holds such a bucket finishes: it is not stuck on a bucket whose
// rows cannot be exported.
func TestClusterDrainOfABucketWithANonUTF8HeaderValue(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a := tc.nodes[0]
	cr := seedBucket(t, a, "utf8drain", "a", 3)
	seedBucket(t, a, "fine1", "a", 3)
	const disp = "attachment; filename=\"caf\xe9.png\""
	a.must(cr, 200, "PUT", "/utf8drain/latin1", []byte("x"), "Content-Disposition", disp)

	a.mustAdmin(202, "POST", "/cluster/nodes/a/drain", nil)
	waitFor(t, 40*time.Second, "a to be empty", func() bool {
		for _, nd := range items2(a.mustAdmin(200, "GET", "/cluster", nil)["nodes"]) {
			if nd["name"] != "a" {
				continue
			}
			d, _ := nd["drain"].(map[string]any)
			return d != nil && d["state"] == "done" && d["remaining"].(float64) == 0 && nd["buckets_homed"].(float64) == 0
		}
		return false
	})
	r := tc.nodes[2].s3(cr, "HEAD", "/utf8drain/latin1", nil)
	if r.status != 200 || r.header.Get("Content-Disposition") != disp {
		t.Fatalf("after the drain: %d, Content-Disposition %q, want %q", r.status, r.header.Get("Content-Disposition"), disp)
	}
}
