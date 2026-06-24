package config

import (
	"strings"
	"testing"
	"time"
)

func minValidConfig() Config {
	return Config{
		LogLevel: "info",
		DataDir:  "/tmp",
		Defaults: Defaults{KeepReleases: 1},
	}
}

func TestValidateAdminTokenMutualExclusion(t *testing.T) {
	cfg := minValidConfig()
	cfg.Admin.TokenEnv = "SOME_ENV"
	cfg.Admin.TokenFile = "/some/file"

	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error when both token_env and token_file are set, got nil")
	}
	if !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected 'mutually exclusive' in error, got: %v", err)
	}
}

func TestValidateAdminTokenEnvOnly(t *testing.T) {
	cfg := minValidConfig()
	cfg.Admin.TokenEnv = "SOME_ENV"
	// token_file unset — should not error from mutual exclusion check
	err := Validate(&cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateAdminTokenFileOnly(t *testing.T) {
	cfg := minValidConfig()
	cfg.Admin.TokenFile = "/some/file"
	// token_env unset — should not error from mutual exclusion check
	err := Validate(&cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// ---- interval -------------------------------------------------------------

func TestValidateDefaultsMinInterval(t *testing.T) {
	cfg := minValidConfig()
	cfg.Defaults.Interval = Duration(10 * time.Second) // below 30 s minimum
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for defaults.interval below minimum, got nil")
	}
	if !strings.Contains(err.Error(), "minimum") {
		t.Fatalf("expected 'minimum' in error, got: %v", err)
	}
}

func TestValidateSiteMinInterval(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:     SourceHTTPZip,
			URL:      "https://example.com/artifact.zip",
			Interval: Duration(5 * time.Second),
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for site interval below minimum, got nil")
	}
	if !strings.Contains(err.Error(), "minimum") {
		t.Fatalf("expected 'minimum' in error, got: %v", err)
	}
}

func TestValidateIntervalAtMinimumOK(t *testing.T) {
	cfg := minValidConfig()
	cfg.Defaults.Interval = Duration(MinInterval)
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error at exactly MinInterval: %v", err)
	}
}

// ---- duplicate domains ----------------------------------------------------

func TestValidateDuplicateDomain(t *testing.T) {
	cfg := minValidConfig()
	site := Site{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
		},
		File: "site-a.yaml",
	}
	cfg.Sites = []Site{site, {
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/b.zip",
		},
		File: "site-b.yaml",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for duplicate domain, got nil")
	}
	if !strings.Contains(err.Error(), "duplicate") {
		t.Fatalf("expected 'duplicate' in error, got: %v", err)
	}
}

// ---- IDNA normalization ---------------------------------------------------

func TestValidateIDNANormalization(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "münchen.de", // Unicode domain
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
		},
		File: "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error for unicode domain: %v", err)
	}
	// Domain must be normalized to punycode.
	if cfg.Sites[0].Domain == "münchen.de" {
		t.Errorf("domain was not converted to punycode: still %q", cfg.Sites[0].Domain)
	}
	if !strings.HasPrefix(cfg.Sites[0].Domain, "xn--") {
		t.Errorf("expected punycode domain starting with xn--, got %q", cfg.Sites[0].Domain)
	}
}

// ---- inline secret traps --------------------------------------------------

func TestValidateInlineTokenRejected(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
			Auth: Auth{Method: AuthBearer, Token: "secret123"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for inline token, got nil")
	}
	if !strings.Contains(err.Error(), "inline") {
		t.Fatalf("expected 'inline' in error, got: %v", err)
	}
}

func TestValidateInlinePasswordRejected(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
			Auth: Auth{Method: AuthBasic, Username: "user", Password: "s3cr3t"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for inline password, got nil")
	}
	if !strings.Contains(err.Error(), "inline") {
		t.Fatalf("expected 'inline' in error, got: %v", err)
	}
}

// ---- git auth matrix ------------------------------------------------------

func TestValidateGitSSHKeyRequiresKeyFile(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthSSHKey}, // no key_file
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for missing key_file, got nil")
	}
	if !strings.Contains(err.Error(), "key_file") {
		t.Fatalf("expected key_file error, got: %v", err)
	}
}

func TestValidateGitSSHKeyRequiresSSHURL(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "https://github.com/example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthSSHKey, KeyFile: "/id_rsa"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for ssh-key with https URL, got nil")
	}
	if !strings.Contains(err.Error(), "ssh-key") {
		t.Fatalf("expected ssh-key error, got: %v", err)
	}
}

func TestValidateGitHTTPSTokenRequiresUsername(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "https://github.com/example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthHTTPSToken, TokenEnv: "MY_TOKEN"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for missing username, got nil")
	}
	if !strings.Contains(err.Error(), "username") {
		t.Fatalf("expected username error, got: %v", err)
	}
}

func TestValidateGitNoneWithSSHURLRejected(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			// no auth — but ssh URL requires ssh-key
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for ssh URL with no auth, got nil")
	}
}

func TestValidateGitHTTPSTokenOK(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "https://github.com/example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthHTTPSToken, Username: "git", TokenEnv: "MY_TOKEN"},
		},
		File: "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateGitGitHubTokenOK(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "https://github.com/example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthGitHubToken, TokenEnv: "GH_TOKEN"},
		},
		File: "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateGitGitHubTokenRejectsUsername(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "https://github.com/example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthGitHubToken, Username: "git", TokenEnv: "GH_TOKEN"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for username set with github-token, got nil")
	}
	if !strings.Contains(err.Error(), "username") {
		t.Fatalf("expected username error, got: %v", err)
	}
}

func TestValidateGitGitHubTokenRequiresTokenRef(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "https://github.com/example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthGitHubToken},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for missing token ref, got nil")
	}
	if !strings.Contains(err.Error(), "token") {
		t.Fatalf("expected token error, got: %v", err)
	}
}

func TestValidateGitGitHubTokenRejectsSSHURL(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthGitHubToken, TokenEnv: "GH_TOKEN"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for github-token with ssh URL, got nil")
	}
	if !strings.Contains(err.Error(), "https") {
		t.Fatalf("expected https error, got: %v", err)
	}
}

// ---- ssh-key: key_file vs key_env ----------------------------------------

func TestValidateGitSSHKeyEnvOK(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthSSHKey, KeyEnv: "SSH_KEY"},
		},
		File: "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateGitSSHKeyRequiresAKeyRef(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthSSHKey},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for ssh-key with no key_file/key_env, got nil")
	}
	if !strings.Contains(err.Error(), "key_env") || !strings.Contains(err.Error(), "key_file") {
		t.Fatalf("expected key_env/key_file error, got: %v", err)
	}
}

func TestValidateGitSSHKeyEnvAndFileExclusive(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthSSHKey, KeyEnv: "SSH_KEY", KeyFile: "/etc/keys/id"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for key_env and key_file both set, got nil")
	}
	if !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected mutually-exclusive error, got: %v", err)
	}
}

func TestValidateGitInlineKeyRejected(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:   SourceGit,
			URL:    "git@github.com:example/repo.git",
			Branch: "main",
			Auth:   Auth{Method: AuthSSHKey, Key: "-----BEGIN OPENSSH PRIVATE KEY-----"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for inline key, got nil")
	}
	if !strings.Contains(err.Error(), "inline secrets") {
		t.Fatalf("expected inline-secrets error, got: %v", err)
	}
}

// ---- http-zip auth matrix -------------------------------------------------

func TestValidateHTTPZipBearerRequiresTokenRef(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
			Auth: Auth{Method: AuthBearer}, // neither token_env nor token_file
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for bearer with no token ref, got nil")
	}
}

func TestValidateHTTPZipBearerTokenEnvAndFileExclusive(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
			Auth: Auth{Method: AuthBearer, TokenEnv: "TOK", TokenFile: "/tok"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for both token_env and token_file set, got nil")
	}
	if !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected 'mutually exclusive' error, got: %v", err)
	}
}

func TestValidateHTTPZipBasicRequiresUsername(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
			Auth: Auth{Method: AuthBasic, PasswordEnv: "MY_PASS"},
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for missing username in basic auth, got nil")
	}
	if !strings.Contains(err.Error(), "username") {
		t.Fatalf("expected username error, got: %v", err)
	}
}

func TestValidateHTTPZipHeaderRequiresName(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "https://example.com/a.zip",
			Auth: Auth{Method: AuthHeader, ValueEnv: "MY_HDR"}, // no name
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for missing auth.name in header auth, got nil")
	}
	if !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected name error, got: %v", err)
	}
}

func TestValidateHTTPZipInsecureRequiresFlag(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type: SourceHTTPZip,
			URL:  "http://example.com/a.zip", // http:// without allow_insecure
		},
		File: "test",
	}}
	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error for http:// without allow_insecure, got nil")
	}
	if !strings.Contains(err.Error(), "allow_insecure") {
		t.Fatalf("expected allow_insecure error, got: %v", err)
	}
}

func TestValidateHTTPZipInsecureWithFlagOK(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{
			Type:          SourceHTTPZip,
			URL:           "http://example.com/a.zip",
			AllowInsecure: true,
		},
		File: "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// ---- upstreams & reverse proxies ------------------------------------------

func validUpstream() Upstream {
	return Upstream{
		Name:    "api_pool",
		Servers: []UpstreamServer{{Address: "10.0.0.1:8080"}},
		File:    "test",
	}
}

func TestValidateProxyReferencingUpstreamOK(t *testing.T) {
	cfg := minValidConfig()
	cfg.Upstreams = []Upstream{validUpstream()}
	cfg.Proxies = []Proxy{{Domain: "api.example.com", Upstream: "api_pool", File: "test"}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateUpstreamNameRequired(t *testing.T) {
	cfg := minValidConfig()
	u := validUpstream()
	u.Name = ""
	cfg.Upstreams = []Upstream{u}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "name is required") {
		t.Fatalf("expected name required error, got: %v", err)
	}
}

func TestValidateUpstreamBadName(t *testing.T) {
	cfg := minValidConfig()
	u := validUpstream()
	u.Name = "api-pool" // hyphen not allowed
	cfg.Upstreams = []Upstream{u}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "[A-Za-z0-9_]") {
		t.Fatalf("expected name charset error, got: %v", err)
	}
}

func TestValidateUpstreamBadBalancer(t *testing.T) {
	cfg := minValidConfig()
	u := validUpstream()
	u.Balancer = "magic"
	cfg.Upstreams = []Upstream{u}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "balancer") {
		t.Fatalf("expected balancer error, got: %v", err)
	}
}

func TestValidateUpstreamNoServers(t *testing.T) {
	cfg := minValidConfig()
	u := validUpstream()
	u.Servers = nil
	cfg.Upstreams = []Upstream{u}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "at least one server") {
		t.Fatalf("expected no-servers error, got: %v", err)
	}
}

func TestValidateUpstreamDuplicateName(t *testing.T) {
	cfg := minValidConfig()
	cfg.Upstreams = []Upstream{validUpstream(), validUpstream()}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "duplicate upstream") {
		t.Fatalf("expected duplicate upstream error, got: %v", err)
	}
}

func TestValidateProxyUnknownUpstream(t *testing.T) {
	cfg := minValidConfig()
	cfg.Proxies = []Proxy{{Domain: "api.example.com", Upstream: "missing", File: "test"}}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "unknown upstream") {
		t.Fatalf("expected unknown upstream error, got: %v", err)
	}
}

func TestValidateProxyUpstreamAndPassMutuallyExclusive(t *testing.T) {
	cfg := minValidConfig()
	cfg.Upstreams = []Upstream{validUpstream()}
	cfg.Proxies = []Proxy{{Domain: "api.example.com", Upstream: "api_pool", Pass: "http://x:1", File: "test"}}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected mutual-exclusion error, got: %v", err)
	}
}

func TestValidateProxyNoTarget(t *testing.T) {
	cfg := minValidConfig()
	cfg.Proxies = []Proxy{{Domain: "api.example.com", File: "test"}}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "upstream/pass") {
		t.Fatalf("expected no-target error, got: %v", err)
	}
}

func TestValidateProxyInlinePassBadScheme(t *testing.T) {
	cfg := minValidConfig()
	cfg.Proxies = []Proxy{{Domain: "api.example.com", Pass: "10.0.0.1:8080", File: "test"}}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "http://") {
		t.Fatalf("expected pass scheme error, got: %v", err)
	}
}

func TestValidateProxyDomainCollidesWithSite(t *testing.T) {
	cfg := minValidConfig()
	cfg.Sites = []Site{{
		Domain: "example.com",
		Source: Source{Type: SourceHTTPZip, URL: "https://x/a.zip"},
		File:   "site.yml",
	}}
	cfg.Proxies = []Proxy{{Domain: "example.com", Pass: "http://127.0.0.1:9000", File: "proxy.yml"}}
	if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "duplicate domain") {
		t.Fatalf("expected duplicate domain error, got: %v", err)
	}
}

func TestValidateProxyLocationInheritsDefault(t *testing.T) {
	cfg := minValidConfig()
	cfg.Upstreams = []Upstream{validUpstream()}
	cfg.Proxies = []Proxy{{
		Domain:    "api.example.com",
		Upstream:  "api_pool",
		Locations: []ProxyLocation{{Path: "/static"}}, // no target → inherits api_pool
		File:      "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Proxies[0].Locations[0].Path != "/static" {
		t.Fatalf("path mangled: %q", cfg.Proxies[0].Locations[0].Path)
	}
}

func TestValidateProxyLocationPathDefaulted(t *testing.T) {
	cfg := minValidConfig()
	cfg.Proxies = []Proxy{{
		Domain:    "api.example.com",
		Locations: []ProxyLocation{{Pass: "http://127.0.0.1:9000"}}, // empty path → "/"
		File:      "test",
	}}
	if err := Validate(&cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := cfg.Proxies[0].Locations[0].Path; got != "/" {
		t.Fatalf("want default path /, got %q", got)
	}
}
