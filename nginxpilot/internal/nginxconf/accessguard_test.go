package nginxconf

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// A redirect's or dead host's `return` runs in the rewrite phase, before the
// access phase, so an attached access list must put it behind try_files (the
// content phase) or it guards nothing.
func TestAccessListGuardsRedirectAndDeadHost(t *testing.T) {
	cfg := &config.Config{AccessLists: []config.AccessList{{
		Name: "staff", Rules: []config.AccessRule{{Allow: "10.0.0.0/8"}},
	}}}
	render := map[string]func() (string, error){
		"redirect": func() (string, error) {
			return RedirectVhost(cfg, &config.Redirect{Domain: "old.example.com", To: "new.example.com", AccessList: "staff"}, Options{})
		},
		"dead host": func() (string, error) {
			return DeadHostVhost(cfg, &config.DeadHost{Domain: "parked.example.com", Code: 410, AccessList: "staff"}, Options{})
		},
	}
	answers := map[string]string{
		"redirect":  "return 301 $scheme://new.example.com$request_uri;",
		"dead host": "return 410;",
	}
	for name, fn := range render {
		out, err := fn()
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		assertBalanced(t, name, out)
		if serverLevelReturn(out) {
			t.Errorf("%s: a server-level return bypasses the access list\n%s", name, out)
		}
		if !strings.Contains(out, "    location / {\n        try_files /.nginxpilot-no-such-file @nginxpilot_answer;\n    }") {
			t.Errorf("%s: location / must reach the answer through try_files\n%s", name, out)
		}
		named := "    location @nginxpilot_answer {\n        " + answers[name] + "\n    }"
		if !strings.Contains(out, named) {
			t.Errorf("%s: missing the named answer location %q\n%s", name, named, out)
		}
		if a, n := strings.Index(out, "deny all;"), strings.Index(out, "location / {"); a < 0 || a > n {
			t.Errorf("%s: the access list must be in force for location /\n%s", name, out)
		}
	}
}

// With HTTP-01 as well, the challenge location still bypasses the list while
// everything else goes through it.
func TestAccessListGuardWithHTTP01(t *testing.T) {
	cfg := withHTTP01(&config.Config{})
	out, err := DeadHostVhost(cfg, &config.DeadHost{Domain: "parked.example.com", Code: 444, AccessList: "staff"}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	assertBalanced(t, "dead host", out)
	ch, root, named := strings.Index(out, acmeLocation), strings.Index(out, "try_files /.nginxpilot-no-such-file"), strings.Index(out, "location @nginxpilot_answer")
	if ch < 0 || root < 0 || named < 0 || !(ch < root && root < named) {
		t.Fatalf("want challenge location, then location /, then the named answer\n%s", out)
	}
	if !strings.Contains(out, "        allow all;") || serverLevelReturn(out) {
		t.Fatalf("challenge must lift the list and no return may sit at server level\n%s", out)
	}
}

// No access list (or a name that resolves to nothing) keeps the plain
// server-level return, byte for byte.
func TestNoAccessListKeepsServerLevelReturn(t *testing.T) {
	plain, err := DeadHostVhost(&config.Config{}, &config.DeadHost{Domain: "parked.example.com", Code: 410}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(plain, "\n    return 410;\n}") || strings.Contains(plain, "@nginxpilot_answer") {
		t.Fatalf("unguarded dead host changed\n%s", plain)
	}
	dangling, err := DeadHostVhost(&config.Config{}, &config.DeadHost{Domain: "parked.example.com", Code: 410, AccessList: "gone"}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if dangling != plain {
		t.Fatalf("an unresolvable access list must render like none\n%s", dangling)
	}
}
