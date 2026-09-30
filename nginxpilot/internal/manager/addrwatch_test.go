package manager

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"reflect"
	"sort"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/targetcheck"
)

// fakeResolver answers from a table the test mutates between ticks. A host
// absent from the table fails to resolve.
type fakeResolver struct{ hosts map[string][]string }

func (f *fakeResolver) LookupHost(_ context.Context, host string) ([]string, error) {
	addrs, ok := f.hosts[host]
	if !ok {
		return nil, errors.New("no such host")
	}
	return addrs, nil
}

func addrTestManager(cfg *config.Config, res *fakeResolver) *Manager {
	return &Manager{
		log:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		cfg:     cfg,
		checker: &targetcheck.Checker{Resolver: res},
	}
}

func addrTestConfig() *config.Config {
	return &config.Config{
		Proxies: []config.Proxy{
			{Domain: "api.example.com", Pass: "http://api.container:5000"},
			{Domain: "agent.example.com", Pass: "http://api.container:5020"},
		},
	}
}

func TestBackendHostsWalksEveryKind(t *testing.T) {
	off := false
	cfg := &config.Config{
		Proxies: []config.Proxy{
			{Domain: "a.com", Pass: "http://web:80", Locations: []config.ProxyLocation{
				{Path: "/api", Pass: "http://api:8080"},
			}},
			{Domain: "ip.com", Pass: "http://10.0.0.4:9000"},
			{Domain: "gone.com", Pass: "http://ghost:80", Enabled: &off},
			{Domain: "dup.com", Pass: "http://web:80"},
		},
		Upstreams:       []config.Upstream{{Name: "pool", Servers: []config.UpstreamServer{{Address: "node-a:80"}}}},
		Streams:         []config.Stream{{Name: "db", Listen: 5432, Pass: "pg:5432"}},
		StreamUpstreams: []config.StreamUpstream{{Name: "spool", Servers: []config.StreamUpstreamServer{{Address: "node-b:5432"}}}},
	}

	got := backendHosts(cfg)
	sort.Strings(got)
	want := []string{"api", "node-a", "node-b", "pg", "web"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("backendHosts() = %v, want %v (IP literals, disabled proxies and duplicates must drop out)", got, want)
	}
}

func TestDriftedHostsOnlyReportsHostsInBoth(t *testing.T) {
	prev := addrSet{"moved": {"172.18.0.6"}, "same": {"10.0.0.1"}, "vanished": {"10.0.0.2"}}
	cur := addrSet{"moved": {"172.18.0.5"}, "same": {"10.0.0.1"}, "added": {"10.0.0.3"}}

	got := driftedHosts(prev, cur)
	if !reflect.DeepEqual(got, []string{"moved"}) {
		t.Fatalf("driftedHosts() = %v, want [moved]: an unchanged, an unresolvable and a brand-new host are all not drift", got)
	}
}

func TestAddressesDriftedBaselinesThenDetects(t *testing.T) {
	res := &fakeResolver{hosts: map[string][]string{"api.container": {"172.18.0.6"}}}
	m := addrTestManager(addrTestConfig(), res)
	ctx := context.Background()

	if m.addressesDrifted(ctx) {
		t.Fatal("the first tick has nothing to compare against and must not apply")
	}
	if m.addressesDrifted(ctx) {
		t.Fatal("an unchanged backend must not apply")
	}

	res.hosts["api.container"] = []string{"172.18.0.5"}
	if !m.addressesDrifted(ctx) {
		t.Fatal("a backend that moved to a new address must trigger an apply")
	}
}

func TestAddressesDriftedIgnoresResolutionFailure(t *testing.T) {
	res := &fakeResolver{hosts: map[string][]string{"api.container": {"172.18.0.6"}}}
	m := addrTestManager(addrTestConfig(), res)
	ctx := context.Background()
	m.refreshAddrSnapshot(ctx)

	delete(res.hosts, "api.container")
	if m.addressesDrifted(ctx) {
		t.Fatal("a DNS outage must read as unknown, not as moved — reloading would not help and would storm")
	}

	res.hosts["api.container"] = []string{"172.18.0.6"}
	if m.addressesDrifted(ctx) {
		t.Fatal("the address came back unchanged; the baseline must have survived the outage")
	}
}

func TestAddressesDriftedRespectsToggle(t *testing.T) {
	res := &fakeResolver{hosts: map[string][]string{"api.container": {"172.18.0.6"}}}
	cfg := addrTestConfig()
	off := false
	cfg.Nginx.Reconcile.WatchAddresses = &off
	m := addrTestManager(cfg, res)
	ctx := context.Background()
	m.refreshAddrSnapshot(ctx)

	res.hosts["api.container"] = []string{"172.18.0.5"}
	if m.addressesDrifted(ctx) {
		t.Fatal("watch_addresses: false must switch the check off entirely")
	}
}

func TestAddressSnapshotIgnoresOrdering(t *testing.T) {
	res := &fakeResolver{hosts: map[string][]string{"api.container": {"10.0.0.2", "10.0.0.1"}}}
	m := addrTestManager(addrTestConfig(), res)
	ctx := context.Background()
	m.refreshAddrSnapshot(ctx)

	res.hosts["api.container"] = []string{"10.0.0.1", "10.0.0.2"}
	if m.addressesDrifted(ctx) {
		t.Fatal("a round-robin answer in a different order is the same answer")
	}
}

// A resolve location is looked up by nginx per request, so it is neither a
// load-time backend to watch for drift nor one whose DNS failure should
// quarantine the proxy. The IP-literal and opted-out passes stay walked.
func TestWalkBackendsSkipsResolveTargets(t *testing.T) {
	off := false
	cfg := &config.Config{
		Proxies: []config.Proxy{
			{Domain: "wmk.example.com", Pass: "http://wmk-abc123:3000", Resolve: true},
			{Domain: "mixed.example.com", Pass: "http://web:80", Resolve: true, Locations: []config.ProxyLocation{
				{Path: "/"},
				{Path: "/api", Pass: "http://api:8080"},
				{Path: "/legacy", Pass: "http://legacy:80", Resolve: &off},
			}},
			{Domain: "half.example.com", Pass: "http://shared:80", Resolve: true, Locations: []config.ProxyLocation{
				{Path: "/"},
				{Path: "/old", Resolve: &off},
			}},
			{Domain: "ip.example.com", Pass: "http://10.0.0.4:3000", Resolve: true},
		},
	}
	got := backendHosts(cfg)
	sort.Strings(got)
	want := []string{"legacy", "shared"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("backendHosts() = %v, want %v (resolve targets must drop out; a default any location still loads at load time must stay)", got, want)
	}

	a := checkerAnnotator{checker: &targetcheck.Checker{Resolver: &fakeResolver{hosts: map[string][]string{}}}}
	notes := a.Annotate(context.Background(), &config.Config{Proxies: cfg.Proxies[:1]})
	if len(notes) != 0 {
		t.Fatalf("a resolve target that does not resolve yet must not be annotated for quarantine: %v", notes)
	}
}
