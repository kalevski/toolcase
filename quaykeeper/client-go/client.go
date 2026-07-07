package quaykeeper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// Flag is a feature flag's resolved value — boolean-only (move_wharf_to_perch.md
// §5): no shared catalog, no per-environment values, so unlike wharf's typed
// Value/Type this carries only Enabled.
type Flag struct {
	Enabled bool `json:"enabled"`
}

// Snapshot is one resolved view of an instance's configuration.
type Snapshot struct {
	Env     map[string]string `json:"env"`
	Flags   map[string]Flag   `json:"flags"`
	// Logs carries this instance's log-shipping destinations (log_ides.md §5.1).
	// Absent for old servers / instances with no destinations — the zero value
	// (no destinations) is the correct "ship nothing" default.
	Logs    LogsConfig `json:"logs"`
	Version string     `json:"version"`
}

// Client talks to a Quaykeeper instance-fetch API for one instance. Exported
// as a library, so concurrent FetchConfig calls (e.g. a caller sharing one
// Client across goroutines) must not race on etag — etagMu guards it.
type Client struct {
	cfg  Config
	http *http.Client

	etagMu sync.Mutex
	etag   string // last seen ETag, for conditional Watch/serve polling
}

// New builds a Client. A nil-safe default HTTP client with a sane timeout is used.
func New(cfg Config) *Client {
	return &Client{cfg: cfg, http: &http.Client{Timeout: 15 * time.Second}}
}

func (c *Client) getETag() string {
	c.etagMu.Lock()
	defer c.etagMu.Unlock()
	return c.etag
}

func (c *Client) setETag(tag string) {
	c.etagMu.Lock()
	c.etag = tag
	c.etagMu.Unlock()
}

func (c *Client) newRequest(ctx context.Context, path string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.URL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.Secret)
	req.Header.Set("X-Quaykeeper-Instance", c.cfg.Instance)
	return req, nil
}

func decode[T any](res *http.Response) (T, error) {
	var out T
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return out, fmt.Errorf("decode %s: %w", res.Request.URL.Path, err)
	}
	return out, nil
}

func statusErr(res *http.Response) error {
	body, _ := io.ReadAll(res.Body)
	return fmt.Errorf("quaykeeper: %s -> %d: %s", res.Request.URL.Path, res.StatusCode, string(body))
}

// FetchEnv returns the resolved environment variables (secrets already
// resolved server-side for this instance).
func (c *Client) FetchEnv(ctx context.Context) (map[string]string, error) {
	if err := c.cfg.Validate(); err != nil {
		return nil, err
	}
	req, err := c.newRequest(ctx, "/v1/env")
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, statusErr(res)
	}
	return decode[map[string]string](res)
}

// FetchFlags returns the resolved feature flags for this instance.
func (c *Client) FetchFlags(ctx context.Context) (map[string]Flag, error) {
	if err := c.cfg.Validate(); err != nil {
		return nil, err
	}
	req, err := c.newRequest(ctx, "/v1/flags")
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, statusErr(res)
	}
	return decode[map[string]Flag](res)
}

// FetchConfig returns the full snapshot. The bool result is whether the config
// CHANGED since the last call (false on a 304 Not Modified). Honors ETag so a
// polling loop is cheap.
func (c *Client) FetchConfig(ctx context.Context) (Snapshot, bool, error) {
	if err := c.cfg.Validate(); err != nil {
		return Snapshot{}, false, err
	}
	req, err := c.newRequest(ctx, "/v1/config")
	if err != nil {
		return Snapshot{}, false, err
	}
	if tag := c.getETag(); tag != "" {
		req.Header.Set("If-None-Match", tag)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return Snapshot{}, false, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotModified {
		return Snapshot{}, false, nil
	}
	if res.StatusCode != http.StatusOK {
		return Snapshot{}, false, statusErr(res)
	}
	snap, err := decode[Snapshot](res)
	if err != nil {
		return Snapshot{}, false, err
	}
	if tag := res.Header.Get("ETag"); tag != "" {
		c.setETag(tag)
	} else {
		c.setETag(snap.Version)
	}
	return snap, true, nil
}

// Watch polls FetchConfig every interval and invokes cb only when the resolved
// config changes. Blocks until ctx is cancelled. The first successful fetch
// always fires cb. Only misconfiguration (Config.Validate) is a permanent,
// returned error — a transient failure on the very first fetch (e.g. the
// control plane blips right as the client boots) is retried on the ticker
// exactly like a steady-state failure, instead of killing Watch outright.
func (c *Client) Watch(ctx context.Context, interval time.Duration, cb func(Snapshot)) error {
	if err := c.cfg.Validate(); err != nil {
		return err
	}
	if interval <= 0 {
		interval = 30 * time.Second
	}
	if snap, changed, err := c.FetchConfig(ctx); err == nil && changed {
		cb(snap)
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			snap, changed, err := c.FetchConfig(ctx)
			if err != nil {
				// transient: keep polling rather than dying mid-run
				continue
			}
			if changed {
				cb(snap)
			}
		}
	}
}
