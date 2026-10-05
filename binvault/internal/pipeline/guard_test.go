package pipeline_test

import (
	"testing"
	"time"
)

// guardCase runs an after pipeline whose service waits until the test says
// "go", then performs requests with its token and reports their statuses. The
// test changes the object in between: every request that names the triggering
// key must then fail with 412, except those that pin the event's version.
type guardOps map[string]int

func runGuard(t *testing.T, versioned bool, event string, between func(n *node, c cred, evVersion string), ops func(n *node, cl *call, evVersion string) guardOps) guardOps {
	t.Helper()
	n := startNode(t, "", nil)
	svc := newService(t)
	settings := map[string]any{}
	if versioned {
		settings["versioning"] = "enabled"
	}
	n.bucket("bkt", settings)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "guarded", "after", map[string]any{
		"events": []string{event},
		"token": map[string]any{"grants": []map[string]any{
			{"actions": []string{"read", "write", "delete", "tag", "purge", "list"}, "keys": []string{"{key}"}},
			{"actions": []string{"read", "write", "delete", "list"}, "keys": []string{"copy/*"}},
		}},
	})
	n.attach("bkt", "guarded")
	arrived := make(chan *call, 1)
	proceed := make(chan struct{})
	done := make(chan guardOps, 1)
	svc.on("guarded", func(cl *call) reply {
		arrived <- cl
		<-proceed
		done <- ops(n, cl, cl.str("object", "version"))
		return reply{}
	})
	if event == "object.deleted" {
		n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1"))
		n.must(c, 204, "DELETE", objPath("bkt", "k"), nil)
	} else {
		n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1"))
	}
	cl := <-arrived
	between(n, c, cl.str("object", "version"))
	close(proceed)
	select {
	case res := <-done:
		return res
	case <-time.After(10 * time.Second):
		t.Fatal("the service never finished")
		return nil
	}
}

func TestStaleWriteGuardOnCreatedEvent(t *testing.T) {
	res := runGuard(t, true, "object.created",
		func(n *node, c cred, ev string) {
			// a newer version arrives while the "scan" is running
			n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v2"))
		},
		func(n *node, cl *call, ev string) guardOps {
			tok := cl.bearer()
			out := guardOps{}
			pinned := "?versionId=" + ev
			out["get plain"] = n.s3b(tok, "GET", objPath("bkt", "k"), nil).status
			out["head plain"] = n.s3b(tok, "HEAD", objPath("bkt", "k"), nil).status
			out["get pinned"] = n.s3b(tok, "GET", objPath("bkt", "k")+pinned, nil).status
			out["head pinned"] = n.s3b(tok, "HEAD", objPath("bkt", "k")+pinned, nil).status
			out["tagging get plain"] = n.s3b(tok, "GET", objPath("bkt", "k")+"?tagging", nil).status
			out["tagging put plain"] = n.s3b(tok, "PUT", objPath("bkt", "k")+"?tagging", []byte(`<Tagging><TagSet><Tag><Key>a</Key><Value>b</Value></Tag></TagSet></Tagging>`)).status
			out["tagging put pinned"] = n.s3b(tok, "PUT", objPath("bkt", "k")+"?tagging&versionId="+ev, []byte(`<Tagging><TagSet><Tag><Key>a</Key><Value>b</Value></Tag></TagSet></Tagging>`)).status
			out["copy from plain"] = n.s3b(tok, "PUT", objPath("bkt", "copy/a"), nil, "x-amz-copy-source", "/bkt/k").status
			out["copy from pinned"] = n.s3b(tok, "PUT", objPath("bkt", "copy/b"), nil, "x-amz-copy-source", "/bkt/k?versionId="+ev).status
			out["put onto key"] = n.s3b(tok, "PUT", objPath("bkt", "k"), []byte("overwrite")).status
			out["write other key"] = n.s3b(tok, "PUT", objPath("bkt", "copy/c"), []byte("derivative")).status
			out["delete plain"] = n.s3b(tok, "DELETE", objPath("bkt", "k"), nil).status
			out["delete other key"] = n.s3b(tok, "DELETE", objPath("bkt", "copy/c"), nil).status
			out["purge pinned"] = n.s3b(tok, "DELETE", objPath("bkt", "k")+pinned, nil).status
			return out
		})
	want := guardOps{
		"get plain": 412, "head plain": 412, "get pinned": 200, "head pinned": 200,
		"tagging get plain": 412, "tagging put plain": 412, "tagging put pinned": 200,
		"copy from plain": 412, "copy from pinned": 200,
		"put onto key": 412, "write other key": 200,
		"delete plain": 412, "delete other key": 204, "purge pinned": 204,
	}
	for k, w := range want {
		if res[k] != w {
			t.Errorf("%s: status %d, want %d", k, res[k], w)
		}
	}
}

// With nothing changed the same requests succeed: the guard only bites on a
// stale object.
func TestStaleWriteGuardAllowsCurrentObject(t *testing.T) {
	res := runGuard(t, true, "object.created",
		func(n *node, c cred, ev string) {},
		func(n *node, cl *call, ev string) guardOps {
			tok := cl.bearer()
			out := guardOps{}
			out["get plain"] = n.s3b(tok, "GET", objPath("bkt", "k"), nil).status
			out["tag"] = n.s3b(tok, "PUT", objPath("bkt", "k")+"?tagging", []byte(`<Tagging><TagSet><Tag><Key>a</Key><Value>b</Value></Tag></TagSet></Tagging>`)).status
			out["copy"] = n.s3b(tok, "PUT", objPath("bkt", "copy/a"), nil, "x-amz-copy-source", "/bkt/k").status
			out["delete"] = n.s3b(tok, "DELETE", objPath("bkt", "k"), nil).status
			return out
		})
	if res["get plain"] != 200 || res["tag"] != 200 || res["copy"] != 200 || res["delete"] != 204 {
		t.Fatalf("%v", res)
	}
}

func TestStaleWriteGuardOnDeletedEvent(t *testing.T) {
	res := runGuard(t, false, "object.deleted",
		func(n *node, c cred, ev string) {
			// the key is uploaded again while the cleanup runs
			n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("again"))
		},
		func(n *node, cl *call, ev string) guardOps {
			tok := cl.bearer()
			out := guardOps{}
			out["get plain"] = n.s3b(tok, "GET", objPath("bkt", "k"), nil).status
			out["delete plain"] = n.s3b(tok, "DELETE", objPath("bkt", "k"), nil).status
			out["put"] = n.s3b(tok, "PUT", objPath("bkt", "k"), []byte("x")).status
			out["tag"] = n.s3b(tok, "PUT", objPath("bkt", "k")+"?tagging", []byte(`<Tagging><TagSet></TagSet></Tagging>`)).status
			out["write derivative"] = n.s3b(tok, "PUT", objPath("bkt", "copy/z"), []byte("x")).status
			return out
		})
	if res["get plain"] != 412 || res["delete plain"] != 412 || res["put"] != 412 || res["tag"] != 412 || res["write derivative"] != 200 {
		t.Fatalf("deleted-event guard: %v", res)
	}
}

func TestStaleWriteGuardDeletedEventKeyStillAbsent(t *testing.T) {
	res := runGuard(t, false, "object.deleted",
		func(n *node, c cred, ev string) {},
		func(n *node, cl *call, ev string) guardOps {
			tok := cl.bearer()
			out := guardOps{}
			out["get plain"] = n.s3b(tok, "GET", objPath("bkt", "k"), nil).status
			out["list"] = n.s3b(tok, "GET", "/bkt?prefix=k", nil).status
			return out
		})
	if res["get plain"] != 404 || res["list"] != 200 {
		t.Fatalf("with the key still absent the cleanup may look: %v", res)
	}
}
