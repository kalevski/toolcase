package app_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
)

func TestListWithMarkerEqualToPrefixIsNotAServerError(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	for _, k := range []string{"dir/", "dir/a", "dir/b"} { // "dir/" is a folder-marker key
		n.must(c, 200, "PUT", "/bkt/"+k, []byte("x"))
	}
	for _, q := range []string{
		"/bkt?prefix=dir/&delimiter=/&marker=dir/",
		"/bkt?versions&prefix=dir/&delimiter=/&key-marker=dir/",
		"/bkt?list-type=2&prefix=dir/&delimiter=/&start-after=dir/",
	} {
		if r := n.s3(c, "GET", q, nil); r.status != 200 {
			t.Fatalf("%s: %d %s", q, r.status, r.body)
		}
	}
	r := n.must(c, 200, "GET", "/bkt?prefix=dir/&delimiter=/&marker=dir/", nil)
	if strings.Contains(string(r.body), "<Key>dir/</Key>") || !strings.Contains(string(r.body), "<Key>dir/a</Key>") {
		t.Fatalf("keys after the marker expected: %s", r.body)
	}
}

func TestListMultipartUploadsWithDelimiterPagesThrough(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	for _, k := range []string{"a/1", "a/2", "b", "c/x"} {
		n.must(c, 200, "POST", "/bkt/"+k+"?uploads", nil)
	}
	var seen []string
	keyMarker := ""
	for page := 0; page < 10; page++ {
		q := "/bkt?uploads&delimiter=/&max-uploads=1"
		if keyMarker != "" {
			q += "&key-marker=" + keyMarker
		}
		r := n.must(c, 200, "GET", q, nil)
		body := string(r.body)
		for _, tag := range []string{"<Prefix>a/</Prefix>", "<Prefix>c/</Prefix>", "<Key>b</Key>"} {
			if strings.Contains(body, tag) {
				seen = append(seen, tag)
			}
		}
		if !strings.Contains(body, "<IsTruncated>true</IsTruncated>") {
			break
		}
		i := strings.Index(body, "<NextKeyMarker>")
		j := strings.Index(body, "</NextKeyMarker>")
		if i < 0 || j < i || j == i+len("<NextKeyMarker>") {
			t.Fatalf("a truncated page must carry a NextKeyMarker: %s", body)
		}
		next := body[i+len("<NextKeyMarker>") : j]
		if next == keyMarker {
			t.Fatalf("paging does not advance (marker %q repeats)", next)
		}
		keyMarker = next
	}
	if got := strings.Join(seen, ","); got != "<Prefix>a/</Prefix>,<Key>b</Key>,<Prefix>c/</Prefix>" {
		t.Fatalf("pages: %s", got)
	}
}

func TestValidateDoesNotTouchALiveNodesStagingDir(t *testing.T) {
	dir := t.TempDir()
	n := startNode(t, func(c *config.Config) { c.DataDir = dir })
	n.bucket("bkt", nil)
	staging := filepath.Join(dir, "tmp", "in-flight-upload")
	if err := os.WriteFile(staging, []byte("a PUT is streaming into this file"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := cfgFor(dir, n.app.Cfg.MasterKey)
	rep, err := app.Validate(t.Context(), cfg, true)
	if err != nil || len(rep.Problems) != 0 {
		t.Fatalf("%+v %v", rep, err)
	}
	if _, err := os.Stat(staging); err != nil {
		t.Fatalf("validate removed a live node's staging file: %v", err)
	}
}
