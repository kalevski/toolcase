package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// adminDo sends one admin-API request over the daemon's local Unix socket
// (admin.socket). The socket needs no token — only the TCP listener checks the
// bearer token, and with only its hash on disk the CLI has none to send.
func adminDo(admin config.Admin, method, path string, body io.Reader, contentType string, timeout time.Duration) (*http.Response, error) {
	socket := admin.SocketPath()
	if socket == "" {
		return nil, fmt.Errorf("the admin socket is disabled (admin.socket is empty); the CLI cannot reach the daemon")
	}
	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var d net.Dialer
				return d.DialContext(ctx, "unix", socket)
			},
		},
	}
	req, err := http.NewRequest(method, "http://nginxpilot"+path, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cannot reach the daemon on %s: %w (is it running, and are you inside its container?)", socket, err)
	}
	return resp, nil
}
