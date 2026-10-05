package lifecycle

import (
	"bytes"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
)

// abort_multipart_days matches prefixes byte-wise, also for non-ASCII keys.
func TestAbortMultipartWithANonASCIIPrefix(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", rules(meta.LifecycleRule{ID: "mp", AbortMultipartDays: 1, Filter: meta.LifecycleFilter{Prefix: "ключ/"}}))
	b, _ := v.e.Bucket(v.ctx, "b")
	for _, key := range []string{"ключ/файл", "other/file"} {
		if _, err := v.e.CreateUpload(v.ctx, &engine.CreateUploadRequest{Bucket: b, Key: key}); err != nil {
			t.Fatal(err)
		}
	}
	if n := v.run(2); n != 1 {
		t.Fatalf("applied %d, want only the matching upload", n)
	}
	if c, _ := v.e.DB.Read().CountOpenUploads(v.ctx, "b"); c != 1 {
		t.Fatalf("%d uploads left", c)
	}
}

// BINVAULT_METRICS_PER_BUCKET=false drops the bucket label of the action counter instead of
// keeping it (spec §9.2): the actions are counted across all buckets.
func TestActionCounterFollowsMetricsPerBucket(t *testing.T) {
	for _, perBucket := range []bool{true, false} {
		v := newEnv(t)
		reg := obs.NewRegistry()
		v.w = NewWith(v.e, 2, slog.New(slog.NewTextHandler(io.Discard, nil)), reg, perBucket)
		for _, name := range []string{"one", "two"} {
			v.bucket(name, rules(meta.LifecycleRule{ID: "r", ExpireDays: 1}))
			v.put(name, "a", "data", nil)
			v.put(name, "b", "data", nil)
		}
		if n := v.run(3); n != 4 {
			t.Fatalf("applied %d, want 4", n)
		}
		var out bytes.Buffer
		if _, err := reg.WriteTo(&out); err != nil {
			t.Fatal(err)
		}
		got := out.String()
		if perBucket {
			for _, want := range []string{
				`binvault_lifecycle_actions_total{bucket="one",action="expire"} 2`,
				`binvault_lifecycle_actions_total{bucket="two",action="expire"} 2`,
			} {
				if !strings.Contains(got, want) {
					t.Errorf("missing %q in:\n%s", want, got)
				}
			}
			continue
		}
		if !strings.Contains(got, `binvault_lifecycle_actions_total{action="expire"} 4`) || strings.Contains(got, `bucket="`) {
			t.Errorf("without per-bucket metrics the counter is one node-wide series:\n%s", got)
		}
	}
}
