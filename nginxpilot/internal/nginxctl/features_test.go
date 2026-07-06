package nginxctl

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// Per-call staging: concurrent DryRuns against the same engine must not
// interfere with an Apply (the old fixed .staging path let a DryRun delete an
// in-flight Apply's staged files). Run many rounds; assert every apply leaves
// the full file set live.
func TestConcurrentDryRunAndApply(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	cfg.Proxies = []config.Proxy{
		{Domain: "a.example.com", Pass: "http://127.0.0.1:9001"},
		{Domain: "b.example.com", Pass: "http://127.0.0.1:9002"},
	}

	var wg sync.WaitGroup
	stop := make(chan struct{})
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
			}
			if _, err := eng.DryRun(context.Background(), cfg, nil); err != nil {
				t.Errorf("dry run: %v", err)
				return
			}
		}
	}()

	for i := 0; i < 20; i++ {
		res, err := eng.Apply(context.Background(), cfg, nil)
		if err != nil {
			t.Fatalf("apply %d: %v", i, err)
		}
		if len(res.Disabled()) != 0 {
			t.Fatalf("apply %d disabled resources: %v", i, res.Disabled())
		}
		if !fileExists(eng.confDir, "proxy-a.example.com.conf") ||
			!fileExists(eng.confDir, "proxy-b.example.com.conf") {
			t.Fatalf("apply %d: a vhost file silently dropped from live dir", i)
		}
	}
	close(stop)
	wg.Wait()
}

// Redirects and dead hosts flow through the same render/apply pipeline with
// their deterministic filenames; enabled: false renders nothing.
func TestApplyRedirectsAndDeadHosts(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	off := false
	cfg.Redirects = []config.Redirect{
		{Domain: "old.example.com", To: "new.example.com"},
		{Domain: "off.example.com", To: "new.example.com", Enabled: &off},
	}
	cfg.DeadHosts = []config.DeadHost{{Domain: "gone.example.com", Code: 410}}

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if len(res.Disabled()) != 0 {
		t.Fatalf("nothing should be disabled: %v", res.Disabled())
	}
	if !fileExists(eng.confDir, "redirect-old.example.com.conf") {
		t.Error("redirect file should be live")
	}
	if fileExists(eng.confDir, "redirect-off.example.com.conf") {
		t.Error("disabled redirect must not render")
	}
	if !fileExists(eng.confDir, "dead-gone.example.com.conf") {
		t.Error("dead-host file should be live")
	}
	for _, r := range res.Resources {
		if r.Key == "off.example.com" {
			t.Errorf("disabled redirect should not appear as a resource: %v", r)
		}
	}
}

// A wildcard proxy renders to the _wildcard. file stem in BOTH the success
// path and the render-error (quarantine) path.
func TestWildcardFileStem(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	cfg.Proxies = []config.Proxy{{Domain: "*.example.com", Pass: "http://127.0.0.1:9001"}}

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if !fileExists(eng.confDir, "proxy-_wildcard.example.com.conf") {
		t.Error("wildcard proxy file must use the _wildcard. stem")
	}
	for _, r := range res.Resources {
		if r.Key == "*.example.com" && r.File != "proxy-_wildcard.example.com.conf" {
			t.Errorf("resource filename mismatch: %q", r.File)
		}
	}

	// Render-error path (tls: required, no cert): the reported filename must be
	// the same stem, and the reason must carry the wildcard DNS-challenge hint.
	cfg.Proxies[0].TLS = config.TLSRequired
	res, err = eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	d := res.Disabled()
	if len(d) != 1 {
		t.Fatalf("expected one disabled resource, got %v", d)
	}
	if d[0].File != "proxy-_wildcard.example.com.conf" {
		t.Errorf("error-path filename mismatch: %q", d[0].File)
	}
	if !strings.Contains(d[0].Reason, "acme.challenge: dns") {
		t.Errorf("wildcard cert hint missing from reason: %q", d[0].Reason)
	}
}

// mapAnnotator is a fake TargetAnnotator.
type mapAnnotator map[string]string

func (m mapAnnotator) Annotate(context.Context, *config.Config) map[string]string { return m }

// When a resource fails nginx -t AND carries a pre-flight annotation, the
// annotation becomes the reason (raw stderr demoted to logs). Resources that
// fail DNS but pass nginx -t stay active.
func TestAnnotatedQuarantineReason(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	cfg.Proxies = []config.Proxy{
		{Domain: "bad.example.com", Pass: "http://127.0.0.1:9002",
			WebOptions: config.WebOptions{Advanced: "# FAILTEST broken"}},
		{Domain: "annotated-but-fine.example.com", Pass: "http://127.0.0.1:9003"},
	}
	eng.SetAnnotator(mapAnnotator{
		AnnotationKey(KindProxy, "bad.example.com"):                "backend host \"db.internal\" does not resolve (checked before nginx -t)",
		AnnotationKey(KindProxy, "annotated-but-fine.example.com"): "backend host \"other.internal\" does not resolve (checked before nginx -t)",
	})

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	state := map[string]ResourceResult{}
	for _, r := range res.Resources {
		state[r.Key] = r
	}
	if got := state["bad.example.com"]; got.State != StateDisabled ||
		!strings.Contains(got.Reason, "does not resolve") {
		t.Errorf("annotated reason not preferred: %+v", got)
	}
	// nginx is the arbiter: an annotation alone never disables anything.
	if got := state["annotated-but-fine.example.com"]; got.State != StateActive {
		t.Errorf("annotation must not disable a passing resource: %+v", got)
	}
}

// A proxy whose location advanced is garbage gets quarantined; the rest stay
// active (feature 2c riding the existing gate).
func TestLocationAdvancedQuarantine(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	cfg.Proxies = []config.Proxy{
		{Domain: "good.example.com", Pass: "http://127.0.0.1:9001"},
		{Domain: "bad.example.com", Locations: []config.ProxyLocation{
			{Path: "/", Pass: "http://127.0.0.1:9002", Advanced: "# FAILTEST this_is_not_a_directive;"},
		}},
	}

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	state := map[string]string{}
	for _, r := range res.Resources {
		state[r.Key] = r.State
	}
	if state["bad.example.com"] != StateDisabled {
		t.Errorf("bad location-advanced proxy should be disabled, got %q", state["bad.example.com"])
	}
	if state["good.example.com"] != StateActive {
		t.Errorf("good proxy should stay active, got %q", state["good.example.com"])
	}
}
