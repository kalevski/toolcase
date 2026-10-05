package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// cmdHealthcheck probes GET /_healthz on the local listen address; the image
// has no curl.
func cmdHealthcheck(args []string) int {
	addr := os.Getenv("WEBMAIL_LISTEN")
	if addr == "" {
		addr = ":8080"
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck: bad WEBMAIL_LISTEN:", err)
		return 1
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	url := "http://" + net.JoinHostPort(host, port) + "/_healthz"
	resp, err := (&http.Client{Timeout: 3 * time.Second}).Get(url)
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "healthcheck: %s -> %s\n", url, strings.TrimSpace(resp.Status))
		return 1
	}
	return 0
}
