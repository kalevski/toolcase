package quaykeeper

import "testing"

func TestCompileLabels(t *testing.T) {
	env := map[string]string{"QUAYKEEPER_INSTANCE": "api-1"}
	d := LogDestConfig{
		Name: "loki", Type: "loki", URL: "https://loki/x",
		Labels: map[string]string{
			"job":      "myapp",               // static literal
			"host":     "${QUAYKEEPER_INSTANCE}", // env substitution (resolved once)
			"severity": "$level",              // per-entry field reference
			"missing":  "${NOPE_UNSET_VAR}",   // unresolved → dropped
		},
	}
	ship, err := d.Compile(env)
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	if ship.Labels.Static["job"] != "myapp" {
		t.Errorf("job = %q, want myapp", ship.Labels.Static["job"])
	}
	if ship.Labels.Static["host"] != "api-1" {
		t.Errorf("host = %q, want api-1 (env-substituted)", ship.Labels.Static["host"])
	}
	if ship.Labels.Dynamic["severity"] != "level" {
		t.Errorf("severity dynamic source = %q, want level", ship.Labels.Dynamic["severity"])
	}
	if _, present := ship.Labels.Static["missing"]; present {
		t.Error("label referencing an unset ${VAR} should be dropped, not empty")
	}
}

func TestCompileEnvSubstFallsBackToProcessEnv(t *testing.T) {
	t.Setenv("REGION", "eu-west")
	d := LogDestConfig{Name: "l", Type: "loki", URL: "https://l/x", Labels: map[string]string{"region": "${REGION}"}}
	ship, err := d.Compile(map[string]string{}) // not in fetched env → falls back to process env
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	if ship.Labels.Static["region"] != "eu-west" {
		t.Errorf("region = %q, want eu-west (process-env fallback)", ship.Labels.Static["region"])
	}
}

func TestCompileSecretResolution(t *testing.T) {
	// Fetched env wins over process env (§5.1).
	t.Setenv("LOKI_PW", "from-process")
	d := LogDestConfig{
		Name: "l", Type: "loki", URL: "https://l/x",
		Auth: LogAuthConfig{Method: "basic", Username: "u", PasswordEnv: "LOKI_PW"},
	}
	ship, err := d.Compile(map[string]string{"LOKI_PW": "from-fetched"})
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	secret, err := ship.Auth.Secret()
	if err != nil {
		t.Fatalf("resolve secret: %v", err)
	}
	if secret != "from-fetched" {
		t.Errorf("secret = %q, want from-fetched (fetched env wins)", secret)
	}

	// With nothing in fetched env, fall back to process env.
	ship2, _ := d.Compile(map[string]string{})
	if s, _ := ship2.Auth.Secret(); s != "from-process" {
		t.Errorf("secret = %q, want from-process (fallback)", s)
	}
}

func TestCompileFilterAndDisabled(t *testing.T) {
	d := LogDestConfig{Name: "l", Type: "loki", URL: "https://l/x", Filter: map[string][]string{"level": {"error"}}}
	if _, err := d.Compile(nil); err != nil {
		t.Fatalf("Compile with app filter: %v", err)
	}
	bad := LogDestConfig{Name: "l", Type: "loki", URL: "https://l/x", Filter: map[string][]string{"bogus": {"x"}}}
	if _, err := bad.Compile(nil); err == nil {
		t.Error("unknown filter field should fail Compile")
	}

	disabled := false
	all := CompileDestinations(LogsConfig{Destinations: []LogDestConfig{{Name: "off", Type: "loki", URL: "https://l/x", Enabled: &disabled}}}, nil)
	if len(all) != 0 {
		t.Errorf("disabled destination should be skipped, got %d", len(all))
	}
}
