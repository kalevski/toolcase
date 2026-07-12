package config

import (
	"fmt"
	"net"
)

// Validate performs semantic checks after Load's syntactic decode (spec §6,
// §5 Auth): thresholds in range, review no looser than block, positive
// limits, a parseable listen address, and a token required on non-loopback
// listens. Field names in errors match the YAML keys so the message points
// at the offending line.
func (c *Config) Validate() error {
	p := c.Policy
	if p.BlockThreshold < 0 || p.BlockThreshold > 1 {
		return fmt.Errorf("policy.block_threshold %.3f out of range [0,1]", p.BlockThreshold)
	}
	if p.ReviewThreshold < 0 || p.ReviewThreshold > 1 {
		return fmt.Errorf("policy.review_threshold %.3f out of range [0,1]", p.ReviewThreshold)
	}
	if p.ReviewThreshold > p.BlockThreshold {
		return fmt.Errorf("policy.review_threshold %.3f > policy.block_threshold %.3f (review is the looser gate)",
			p.ReviewThreshold, p.BlockThreshold)
	}

	if c.Limits.MaxBodyMB <= 0 {
		return fmt.Errorf("limits.max_body_mb must be > 0")
	}
	if c.Limits.MaxPixels <= 0 {
		return fmt.Errorf("limits.max_pixels must be > 0")
	}
	if c.Limits.QueueTimeout.Std() <= 0 {
		return fmt.Errorf("limits.queue_timeout must be > 0")
	}
	if c.Limits.RequestTimeout.Std() <= 0 {
		return fmt.Errorf("limits.request_timeout must be > 0")
	}

	if c.Inference.Concurrency < 1 {
		return fmt.Errorf("inference.concurrency must be >= 1")
	}
	if c.Inference.Threads < 0 {
		return fmt.Errorf("inference.threads must be >= 0 (0 = NumCPU)")
	}

	if _, _, err := net.SplitHostPort(c.Listen); err != nil {
		return fmt.Errorf("listen %q: %w", c.Listen, err)
	}

	if c.API.TokenEnv == "" && !isLoopbackListen(c.Listen) {
		return fmt.Errorf("api.token_env must be set when listen (%s) is non-loopback", c.Listen)
	}

	if c.Log.Format != "logfmt" && c.Log.Format != "json" {
		return fmt.Errorf("log.format %q not in {logfmt,json}", c.Log.Format)
	}

	return nil
}

// isLoopbackListen reports whether addr binds only the loopback interface,
// where a tokenless dev run is permitted (spec §5). An unparseable addr, ""
// or a wildcard host ("0.0.0.0" / "::") binds all interfaces and is treated
// as non-loopback, so the caller falls through to requiring a token.
func isLoopbackListen(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.IsLoopback()
	}
	return false
}
