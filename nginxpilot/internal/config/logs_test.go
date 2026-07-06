package config

import (
	"strings"
	"testing"
)

// minimalCfg returns a valid config skeleton for validateLogs-focused tests.
func minimalCfg() *Config {
	cfg := &Config{LogLevel: "info", Defaults: Defaults{KeepReleases: 3}}
	return cfg
}

func lokiDest(mutate func(*LogDestination)) LogDestination {
	d := LogDestination{
		Name: "main-loki",
		Type: LogDestLoki,
		URL:  "https://loki.example.com/loki/api/v1/push",
		Auth: LogAuth{Method: "basic", Username: "loki", PasswordEnv: "LOKI_PASSWORD"},
		Labels: map[string]string{
			"job":         "nginx",
			"host":        "$resource",
			"status_code": "$status",
		},
		Filter: map[string][]string{"status": {"4xx", "5xx"}},
	}
	if mutate != nil {
		mutate(&d)
	}
	return d
}

func TestValidateLogDestinations(t *testing.T) {
	cases := []struct {
		name     string
		mutate   func(*LogDestination)
		wildcard bool
		wantSub  string // "" = valid
	}{
		{name: "valid loki destination"},
		{name: "name required", mutate: func(d *LogDestination) { d.Name = "" }, wantSub: "name is required"},
		{name: "name slug only", mutate: func(d *LogDestination) { d.Name = "Bad_Name" }, wantSub: "[a-z0-9-]+"},
		{name: "name path trick", mutate: func(d *LogDestination) { d.Name = "../../etc" }, wantSub: "[a-z0-9-]+"},
		{name: "type required", mutate: func(d *LogDestination) { d.Type = "" }, wantSub: "type is required"},
		{name: "unknown type", mutate: func(d *LogDestination) { d.Type = "kafka" }, wantSub: "must be loki | http | file | stdout"},
		{name: "url required", mutate: func(d *LogDestination) { d.URL = "" }, wantSub: "url is required"},
		{name: "http url needs allow_insecure", mutate: func(d *LogDestination) { d.URL = "http://loki.internal/push" }, wantSub: "allow_insecure"},
		{name: "http url with allow_insecure", mutate: func(d *LogDestination) { d.URL = "http://loki.internal/push"; d.AllowInsecure = true }},
		{name: "skip verify needs allow_insecure", mutate: func(d *LogDestination) { d.InsecureSkipVerify = true }, wantSub: "insecure_skip_verify"},
		{name: "inline password trapped", mutate: func(d *LogDestination) { d.Auth.Password = "hunter2" }, wantSub: "inline secrets are not allowed"},
		{name: "basic needs username", mutate: func(d *LogDestination) { d.Auth.Username = "" }, wantSub: "username is required"},
		{name: "basic needs exactly one ref", mutate: func(d *LogDestination) { d.Auth.PasswordFile = "/run/secret" }, wantSub: "mutually exclusive"},
		{name: "bearer rejects username", mutate: func(d *LogDestination) {
			d.Auth = LogAuth{Method: "bearer", Username: "x", TokenEnv: "TOK"}
		}, wantSub: "username only applies"},
		{name: "dynamic label whitelist", mutate: func(d *LogDestination) { d.Labels["host"] = "$remote_addr" }, wantSub: "labels.host"},
		{name: "status source whitelist", mutate: func(d *LogDestination) { d.Labels["status_code"] = "$uri" }, wantSub: "labels.status_code"},
		{name: "extra label must be static", mutate: func(d *LogDestination) { d.Labels["path"] = "$path" }, wantSub: "must be static"},
		{name: "extra label name grammar", mutate: func(d *LogDestination) { d.Labels["bad-name"] = "x" }, wantSub: "label names must match"},
		{name: "reserved label prefix", mutate: func(d *LogDestination) { d.Labels["__meta"] = "x" }, wantSub: "reserved"},
		{name: "too many extra labels", mutate: func(d *LogDestination) {
			for _, k := range []string{"a", "b", "c", "d", "e", "f"} {
				d.Labels[k] = "v"
			}
		}, wantSub: "at most 5 extra"},
		{name: "$host banned with wildcard vhosts", mutate: func(d *LogDestination) { d.Labels["host"] = "$host" }, wildcard: true, wantSub: "unsafe with wildcard"},
		{name: "$host fine without wildcards", mutate: func(d *LogDestination) { d.Labels["host"] = "$host" }},
		{name: "$resource fine with wildcards", wildcard: true},
		{name: "bad filter field", mutate: func(d *LogDestination) { d.Filter = map[string][]string{"nope": {"x"}} }, wantSub: "not filterable"},
		{name: "bad sample", mutate: func(d *LogDestination) { s := 1.5; d.Sample = &s }, wantSub: "sample"},
		{name: "labels rejected on http", mutate: func(d *LogDestination) { d.Type = LogDestHTTP; d.Tenant = "" }, wantSub: "labels only apply"},
		{name: "file needs path", mutate: func(d *LogDestination) {
			*d = LogDestination{Name: "f", Type: LogDestFile}
		}, wantSub: "path is required"},
		{name: "file path absolute", mutate: func(d *LogDestination) {
			*d = LogDestination{Name: "f", Type: LogDestFile, Path: "rel/x.ndjson"}
		}, wantSub: "must be absolute"},
		{name: "valid file destination", mutate: func(d *LogDestination) {
			*d = LogDestination{Name: "f", Type: LogDestFile, Path: "/var/log/np/x.ndjson"}
		}},
		{name: "stdout rejects push fields", mutate: func(d *LogDestination) {
			*d = LogDestination{Name: "s", Type: LogDestStdout, URL: "https://x"}
		}, wantSub: "only apply to type: loki | http"},
		{name: "valid stdout destination", mutate: func(d *LogDestination) {
			*d = LogDestination{Name: "s", Type: LogDestStdout}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := minimalCfg()
			if tc.wildcard {
				cfg.Proxies = []Proxy{{Domain: "*.shop.example.com", Pass: "http://127.0.0.1:3000"}}
			}
			cfg.LogDestinations = []LogDestination{lokiDest(tc.mutate)}
			err := validateLogs(cfg)
			if tc.wantSub == "" {
				if err != nil {
					t.Fatalf("want valid, got: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantSub) {
				t.Fatalf("want error containing %q, got: %v", tc.wantSub, err)
			}
		})
	}
}

func TestValidateLogsAccess(t *testing.T) {
	cfg := minimalCfg()
	cfg.Logs.Access = AccessLogs{Enabled: true, Mode: "file"}
	if err := validateLogs(cfg); err == nil || !strings.Contains(err.Error(), "only \"syslog\"") {
		t.Errorf("mode file must be rejected, got: %v", err)
	}
	cfg.Logs.Access = AccessLogs{Enabled: true, SyslogListen: "not-an-addr"}
	if err := validateLogs(cfg); err == nil || !strings.Contains(err.Error(), "host:port") {
		t.Errorf("bad listen must be rejected, got: %v", err)
	}
	cfg.Logs.Access = AccessLogs{Enabled: true}
	if err := validateLogs(cfg); err != nil {
		t.Errorf("defaults must validate: %v", err)
	}
}

func TestDuplicateLogDestinationName(t *testing.T) {
	cfg := minimalCfg()
	cfg.LogDestinations = []LogDestination{
		{Name: "x", Type: LogDestStdout, File: "a.yml"},
		{Name: "x", Type: LogDestStdout, File: "b.yml"},
	}
	err := validateLogs(cfg)
	if err == nil || !strings.Contains(err.Error(), "duplicate log_destination") {
		t.Fatalf("want duplicate error, got: %v", err)
	}
}

func TestShipDestinationMapping(t *testing.T) {
	t.Setenv("LOKI_PASSWORD", "hunter2")
	sample := 0.25
	d := lokiDest(func(d *LogDestination) {
		d.Tenant = "infra"
		d.Labels["env"] = "prod"
		d.Sample = &sample
		d.BatchSize = 100
	})
	ship, err := d.ShipDestination()
	if err != nil {
		t.Fatal(err)
	}
	if ship.Labels.Job != "nginx" || ship.Labels.HostSource != "$resource" || ship.Labels.StatusSource != "$status" {
		t.Errorf("labels mapping wrong: %+v", ship.Labels)
	}
	if ship.Labels.Static["env"] != "prod" {
		t.Errorf("static labels wrong: %v", ship.Labels.Static)
	}
	if ship.Filter == nil {
		t.Error("filter not compiled")
	}
	if ship.Sample != 0.25 || ship.BatchSize != 100 || ship.Tenant != "infra" {
		t.Errorf("tunables wrong: %+v", ship)
	}
	secret, err := ship.Auth.Secret()
	if err != nil || secret != "hunter2" {
		t.Errorf("secret resolve = %q, %v", secret, err)
	}

	// Job label defaults to "nginx" when labels omit it.
	d2 := lokiDest(func(d *LogDestination) { delete(d.Labels, "job") })
	ship2, err := d2.ShipDestination()
	if err != nil {
		t.Fatal(err)
	}
	if ship2.Labels.Job != "nginx" {
		t.Errorf("job default = %q", ship2.Labels.Job)
	}

	// Spec fingerprints differ when config differs, match when identical.
	same, _ := d.ShipDestination()
	if !ship.SameSpec(&same) {
		t.Error("identical config must produce the same spec")
	}
	if ship.SameSpec(&ship2) {
		t.Error("different config must produce different specs")
	}
}
