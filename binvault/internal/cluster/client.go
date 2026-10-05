package cluster

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

// newTransports builds the peer HTTP transports (spec §8.3): HTTPS verified
// against the system roots plus BINVAULT_CLUSTER_CA_FILE (an extra CA bundle or
// a pinned self-signed certificate), or plain HTTP when the config allows it.
// The first client carries the small JSON calls of the peer API; the second
// transport has no overall timeout and is for forwarded requests and other
// streams (its dial timeout is BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT).
func newTransports(cfg *config.Config, t Tuning) (*http.Client, *http.Transport, error) {
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if cfg.ClusterCAFile != "" {
		pem, err := os.ReadFile(cfg.ClusterCAFile)
		if err != nil {
			return nil, nil, fmt.Errorf("cluster: BINVAULT_CLUSTER_CA_FILE: %w", err)
		}
		pool, err := x509.SystemCertPool()
		if err != nil || pool == nil {
			pool = x509.NewCertPool()
		}
		if !pool.AppendCertsFromPEM(pem) {
			return nil, nil, fmt.Errorf("cluster: BINVAULT_CLUSTER_CA_FILE %s: no certificates found", cfg.ClusterCAFile)
		}
		tlsCfg.RootCAs = pool
	}
	mk := func(dial time.Duration) *http.Transport {
		return &http.Transport{
			// a peer request carries the cluster key: never through an
			// environment-configured proxy
			Proxy:                 nil,
			DialContext:           (&net.Dialer{Timeout: dial, KeepAlive: 30 * time.Second}).DialContext,
			TLSClientConfig:       tlsCfg.Clone(),
			TLSHandshakeTimeout:   dial,
			MaxIdleConnsPerHost:   4,
			IdleConnTimeout:       90 * time.Second,
			ResponseHeaderTimeout: 0,
		}
	}
	apiDial := 5 * time.Second
	fwdDial := cfg.ClusterForwardConnectTimeout
	if fwdDial <= 0 {
		fwdDial = 3 * time.Second
	}
	return &http.Client{
		Transport: mk(apiDial),
		// A peer never answers with a redirect, and a client that followed one would
		// carry X-Binvault-Peer-Key (Go copies custom headers along) to wherever the
		// Location points, another host included. The 3xx is the answer; the callers
		// take any status but 200 for an error.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}, mk(fwdDial), nil
}

// authRequest signs a request to a peer: the cluster key, this node's id (so
// the peer can record what we have applied) and the master key ids this node can
// open (so the peer withholds ops sealed under any other key).
func (n *Node) authRequest(req *http.Request) {
	req.Header.Set(HeaderPeerKey, string(n.keys[0]))
	req.Header.Set(HeaderNode, n.id)
	req.Header.Set(HeaderKeyIDs, joinIDs(n.keyIDStrings()))
}

// AuthRequest adds the peer credentials to req, for the forwarder and the admin
// and move calls of later stages.
func (n *Node) AuthRequest(req *http.Request) { n.authRequest(req) }

// ForwardTransport is the transport for forwarded S3 requests and other peer
// streams: it has the cluster TLS settings, a dial timeout of
// BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT and no overall timeout, and it never
// uses a proxy.
func (n *Node) ForwardTransport() http.RoundTripper { return n.fwd }

// Client is the HTTP client for the small JSON calls of the peer API (no overall
// timeout: bound each call with a context). It does not follow redirects: a 3xx
// comes back as the answer, to be treated as the failure it is.
func (n *Node) Client() *http.Client { return n.client }

// statusError is a peer answering with a status other than 200.
type statusError struct {
	code int
	body string
}

func (e *statusError) Error() string {
	if e.body == "" {
		return fmt.Sprintf("peer answered HTTP %d", e.code)
	}
	return fmt.Sprintf("peer answered HTTP %d: %s", e.code, e.body)
}

// getJSON calls GET url and decodes the JSON answer (at most limit bytes) into
// out. It returns the response headers.
func (n *Node) getJSON(ctx context.Context, url string, limit int64, out any) (http.Header, error) {
	ctx, cancel := context.WithTimeout(ctx, n.tune.RequestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	n.authRequest(req)
	resp, err := n.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("answer from %s is larger than %d bytes", redact(url), limit)
	}
	if resp.StatusCode != http.StatusOK {
		return resp.Header, &statusError{code: resp.StatusCode, body: strings.TrimSpace(clipBytes(body, 200))}
	}
	return resp.Header, json.NewDecoder(bytes.NewReader(body)).Decode(out)
}

func clipBytes(b []byte, n int) string {
	if len(b) > n {
		return string(b[:n]) + "…"
	}
	return string(b)
}

// redact drops the query from a URL for error messages.
func redact(u string) string {
	if i := strings.IndexByte(u, '?'); i >= 0 {
		return u[:i]
	}
	return u
}

// post sends an empty POST and drains the answer (nudges).
func (n *Node) post(ctx context.Context, url string, hdr map[string]string) error {
	ctx, cancel := context.WithTimeout(ctx, n.tune.RequestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return err
	}
	n.authRequest(req)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode >= 300 {
		return &statusError{code: resp.StatusCode}
	}
	return nil
}
