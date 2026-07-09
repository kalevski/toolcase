package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/config"
)

// cmdHealthcheck is the distroless HEALTHCHECK helper (spec §7, §9): the
// container image has no wget/curl, so the binary probes its own /healthz
// over HTTP and exits 0/1 for Docker's HEALTHCHECK CMD to read. No bearer
// token is used — /healthz is the unauthenticated liveness endpoint
// (spec §5), and this command never loads the model or opens a listener.
func cmdHealthcheck(args []string) int {
	fs := flag.NewFlagSet("healthcheck", flag.ExitOnError)
	url := fs.String("url", "", "health URL (default derived from config listen)")
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)

	target := *url
	if target == "" {
		// Derive from config listen; a config error is itself unhealthy.
		res, err := config.Load(*configPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "healthcheck: cannot read config: %v\n", err)
			return 1
		}
		cfg := res.Config
		host, port, err := net.SplitHostPort(cfg.Listen)
		if err != nil {
			fmt.Fprintf(os.Stderr, "healthcheck: bad listen %q: %v\n", cfg.Listen, err)
			return 1
		}
		if host == "" || host == "0.0.0.0" || host == "::" {
			host = "127.0.0.1" // probe loopback, not the wildcard bind
		}
		target = fmt.Sprintf("http://%s/healthz", net.JoinHostPort(host, port))
	}

	client := &http.Client{Timeout: 3 * time.Second} // match HEALTHCHECK --timeout=3s
	resp, err := client.Get(target)
	if err != nil {
		fmt.Fprintf(os.Stderr, "healthcheck: %v\n", err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "healthcheck: %s returned %d\n", target, resp.StatusCode)
		return 1
	}
	return 0
}
