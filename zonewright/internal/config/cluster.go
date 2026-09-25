package config

import (
	"fmt"
	"net/url"
	"strings"
)

// Cluster configures replication (REPLICATION.md §8, §10). Every server gets
// the same URL list, itself included; each finds itself by its generated id.
type Cluster struct {
	// KeyFile / KeyFiles hold the shared cluster key (≥ 32 bytes, 0600/0640).
	// During rotation list both; the first is presented, all are accepted.
	KeyFile  string   `yaml:"key_file"`
	KeyFiles []string `yaml:"key_files"`
	// KeyEnv names an env var holding the key instead (containers: a
	// mounted file carries the host uid and fails the ownership check).
	KeyEnv string   `yaml:"key_env"`
	URLs   []string `yaml:"urls"`
	// Listen is the peer listener address.
	Listen string   `yaml:"listen"`
	TLS    TLSFiles `yaml:"tls"`
	// CAFile / Fingerprint verify peers with self-signed certificates.
	// Neither set → the system CA roots.
	CAFile      string `yaml:"ca_file"`
	Fingerprint string `yaml:"fingerprint"`
	// AllowInsecureHTTP permits http:// peer URLs and a plain-HTTP
	// non-loopback listener. The cluster key then travels readable.
	AllowInsecureHTTP bool `yaml:"allow_insecure_http"`
	// Durations use the TTL syntax (seconds, or s/m/h/d/w units).
	PullInterval TTL `yaml:"pull_interval"`
	MaxClockSkew TTL `yaml:"max_clock_skew"`
	StartupFence TTL `yaml:"startup_fence"`
	Retention    TTL `yaml:"retention"`
}

// Cluster defaults.
const (
	DefaultPullInterval TTL = 5
	DefaultMaxClockSkew TTL = 120
	DefaultStartupFence TTL = 30
	DefaultRetention    TTL = 30 * 86400
)

// Keys lists the configured key files, primary first.
func (c *Cluster) Keys() []string {
	if c.KeyFile != "" {
		return append([]string{c.KeyFile}, c.KeyFiles...)
	}
	return c.KeyFiles
}

func applyClusterDefaults(c *Cluster) {
	if c.PullInterval == 0 {
		c.PullInterval = DefaultPullInterval
	}
	if c.MaxClockSkew == 0 {
		c.MaxClockSkew = DefaultMaxClockSkew
	}
	if c.StartupFence == 0 {
		c.StartupFence = DefaultStartupFence
	}
	if c.Retention == 0 {
		c.Retention = DefaultRetention
	}
}

func validateCluster(c *Cluster) error {
	if len(c.Keys()) == 0 && c.KeyEnv == "" {
		return fmt.Errorf("cluster: key_file or key_env is required")
	}
	if len(c.URLs) == 0 {
		return fmt.Errorf("cluster: urls must list every server (this one included)")
	}
	if c.Listen == "" {
		return fmt.Errorf("cluster: listen is required")
	}
	if c.CAFile != "" && c.Fingerprint != "" {
		return fmt.Errorf("cluster: set ca_file or fingerprint, not both")
	}
	if c.Fingerprint != "" {
		fp := strings.TrimPrefix(strings.ToLower(c.Fingerprint), "sha256:")
		fp = strings.ReplaceAll(fp, ":", "")
		if len(fp) != 64 || strings.Trim(fp, "0123456789abcdef") != "" {
			return fmt.Errorf("cluster: fingerprint must be a sha256 of the peer certificate (64 hex digits)")
		}
		c.Fingerprint = fp
	}
	seen := map[string]bool{}
	for i, raw := range c.URLs {
		u, err := url.Parse(strings.TrimRight(strings.TrimSpace(raw), "/"))
		if err != nil || u.Host == "" || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.User != nil {
			return fmt.Errorf("cluster: urls[%d] %q must be scheme://host[:port]", i, raw)
		}
		switch u.Scheme {
		case "https":
		case "http":
			if !c.AllowInsecureHTTP {
				return fmt.Errorf("cluster: urls[%d] %q is plain http — the cluster key would travel readable; use https or set allow_insecure_http: true (private networks only)", i, raw)
			}
		default:
			return fmt.Errorf("cluster: urls[%d] %q must be http(s)", i, raw)
		}
		norm := u.Scheme + "://" + strings.ToLower(u.Host)
		if seen[norm] {
			return fmt.Errorf("cluster: urls[%d] %q is listed twice", i, raw)
		}
		seen[norm] = true
		c.URLs[i] = norm
	}
	if !c.TLS.Enabled() && !loopbackListen(c.Listen) && !c.AllowInsecureHTTP {
		return fmt.Errorf("cluster: listen %q is not loopback and has no tls: set cluster.tls, bind 127.0.0.1 behind a TLS proxy, or set allow_insecure_http: true", c.Listen)
	}
	if (c.TLS.CertFile == "") != (c.TLS.KeyFile == "") {
		return fmt.Errorf("cluster: tls needs both cert_file and key_file")
	}
	return nil
}
