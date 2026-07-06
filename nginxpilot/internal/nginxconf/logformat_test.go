package nginxconf

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func logsEnabledCfg() *config.Config {
	cfg := &config.Config{}
	cfg.Logs.Access.Enabled = true
	cfg.Proxies = []config.Proxy{{Domain: "api.example.com", Pass: "http://127.0.0.1:3000"}}
	cfg.Sites = []config.Site{{Domain: "www.example.com"}}
	cfg.Redirects = []config.Redirect{{Domain: "old.example.com", To: "www.example.com"}}
	cfg.DeadHosts = []config.DeadHost{{Domain: "dead.example.com"}}
	return cfg
}

func TestLogFormatInclude(t *testing.T) {
	cfg := logsEnabledCfg()
	inc := LogFormatInclude(cfg)
	for _, want := range []string{
		"log_format " + LogFormatName + " escape=json",
		`"status":$status,`, // numeric, unquoted → real JSON number
		`"bytes_sent":$body_bytes_sent,`,
		`"upstream_time":"$upstream_response_time",`, // string: comma list on retries
		`"resource":"$np_resource",`,
		`"resource_type":"$np_resource_type"`,
	} {
		if !strings.Contains(inc, want) {
			t.Errorf("include missing %q:\n%s", want, inc)
		}
	}
	cfg.Logs.Access.Enabled = false
	if LogFormatInclude(cfg) != "" {
		t.Error("include must be empty when access logging is disabled")
	}
}

func TestManagedVhostsCarryAccessLog(t *testing.T) {
	cfg := logsEnabledCfg()
	opts := Options{Managed: true}
	cases := []struct {
		domain, resourceType string
	}{
		{"www.example.com", "site"},
		{"api.example.com", "proxy"},
		{"old.example.com", "redirect"},
		{"dead.example.com", "dead_host"},
	}
	for _, tc := range cases {
		out, err := VhostOpts(cfg, tc.domain, opts)
		if err != nil {
			t.Fatalf("%s: %v", tc.domain, err)
		}
		for _, want := range []string{
			`set $np_resource "` + tc.domain + `";`,
			`set $np_resource_type "` + tc.resourceType + `";`,
			"access_log syslog:server=" + config.DefaultSyslogListen + ",tag=nginxpilot " + LogFormatName + ";",
		} {
			if !strings.Contains(out, want) {
				t.Errorf("%s vhost missing %q:\n%s", tc.domain, want, out)
			}
		}
	}
}

func TestGenerateOnlyVhostCommentsAccessLog(t *testing.T) {
	cfg := logsEnabledCfg()
	out, err := VhostOpts(cfg, "api.example.com", Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "# access_log syslog:server=") {
		t.Errorf("print-vhost must comment the directive:\n%s", out)
	}
	if strings.Contains(out, "\n    access_log syslog:") {
		t.Errorf("print-vhost must not emit a live directive:\n%s", out)
	}
}

func TestVhostsSilentWhenLogsDisabled(t *testing.T) {
	cfg := logsEnabledCfg()
	cfg.Logs.Access.Enabled = false
	out, err := VhostOpts(cfg, "api.example.com", Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "np_resource") || strings.Contains(out, "access_log") {
		t.Errorf("disabled logs must not render directives:\n%s", out)
	}
}
