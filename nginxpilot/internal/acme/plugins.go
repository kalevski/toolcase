package acme

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// pluginProbe caches the DNS plugins certbot reports, found once per Client.
type pluginProbe struct {
	once    sync.Once
	mu      sync.Mutex
	done    bool
	plugins []string
	err     error
}

// ProbeDNSPlugins runs `certbot plugins` (once per Client) and caches the
// installed DNS plugins, e.g. ["cloudflare", "zonewright"]. It is meant to run
// in the background when the client is created; DNSPlugins reads the result.
func (c *Client) ProbeDNSPlugins(ctx context.Context) {
	c.plugins.once.Do(func() {
		ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		args := append(c.baseArgs(), "plugins")
		out, err := c.run(ctx, nil, "certbot", args...)
		list := parseDNSPlugins(out)
		if err != nil {
			err = fmt.Errorf("certbot plugins: %s", lastLines(out, err))
			if c.log != nil {
				c.log.Warn("could not list certbot DNS plugins", "error", err)
			}
		}
		c.plugins.mu.Lock()
		c.plugins.done, c.plugins.plugins, c.plugins.err = true, list, err
		c.plugins.mu.Unlock()
	})
}

// DNSPlugins returns the cached probe result without blocking: known is false
// until ProbeDNSPlugins has finished.
func (c *Client) DNSPlugins() (plugins []string, known bool, err error) {
	c.plugins.mu.Lock()
	defer c.plugins.mu.Unlock()
	return c.plugins.plugins, c.plugins.done, c.plugins.err
}

// parseDNSPlugins extracts the DNS authenticators from `certbot plugins`
// output, whose entries start with "* <name>".
func parseDNSPlugins(out string) []string {
	list := []string{}
	for _, line := range strings.Split(out, "\n") {
		name, ok := strings.CutPrefix(strings.TrimSpace(line), "* dns-")
		if ok && name != "" && !strings.ContainsAny(name, " \t") {
			list = append(list, name)
		}
	}
	sort.Strings(list)
	return list
}
