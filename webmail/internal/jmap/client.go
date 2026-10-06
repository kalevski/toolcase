// Package jmap is the thin upstream side of the gateway: the session
// document, request filtering (allow-lists) and an authenticated HTTP client
// to the mail server. Server-specific details live in quirks.go.
package jmap

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Errors from the upstream.
var (
	// ErrUnauthorized is an upstream 401: the session credential is dead, so
	// the webmail session must end (spec §3.3 revocation).
	ErrUnauthorized = errors.New("jmap: upstream rejected the session credential")
	// ErrUnavailable is any other upstream failure.
	ErrUnavailable = errors.New("jmap: upstream unavailable")
)

// Client calls the mail server with a user's session credential.
type Client struct {
	Base    string // WEBMAIL_JMAP_URL, no trailing slash
	HTTP    *http.Client
	Timeout time.Duration // for non-streaming calls
}

// New returns a client. The transport has only a response-header timeout, so
// downloads, uploads and the event stream are not cut by a total deadline.
func New(base string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &Client{Base: strings.TrimRight(base, "/"), Timeout: timeout,
		HTTP: &http.Client{
			Transport: &http.Transport{Proxy: http.ProxyFromEnvironment, MaxIdleConnsPerHost: 64,
				IdleConnTimeout: 60 * time.Second, ResponseHeaderTimeout: timeout},
			// Never follow a redirect with credentials attached.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 3 || req.URL.Host != via[0].URL.Host {
					return http.ErrUseLastResponse
				}
				return nil
			},
		}}
}

// Resolve turns a URL advertised in the session document into one on the
// configured base: only its path and query are kept.
func (c *Client) Resolve(advertised string) (string, error) {
	u, err := url.Parse(advertised)
	if err != nil {
		return "", err
	}
	base, err := url.Parse(c.Base)
	if err != nil {
		return "", err
	}
	if !u.IsAbs() {
		return base.ResolveReference(u).String(), nil
	}
	if !rerootable(u) {
		return "", fmt.Errorf("jmap: advertised URL has no path: %q", advertised)
	}
	out := *base
	out.Path, out.RawPath, out.RawQuery = u.Path, u.RawPath, u.RawQuery
	return out.String(), nil
}

// Request builds an authenticated upstream request. xff, if set, is sent as
// X-Forwarded-For so the mail server's own limiter sees the user's address.
func (c *Client) Request(ctx context.Context, address, credential, method, target string, body io.Reader, xff string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, target, body)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(BasicUser(address), credential)
	if xff != "" {
		req.Header.Set("X-Forwarded-For", xff)
	}
	return req, nil
}

// Do sends req and maps a 401 to ErrUnauthorized and transport errors to
// ErrUnavailable. The caller closes the body.
func (c *Client) Do(req *http.Request) (*http.Response, error) {
	resp, err := c.HTTP.Do(req)
	if err != nil {
		if req.Context().Err() != nil {
			return nil, req.Context().Err()
		}
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err
		}
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		return nil, ErrUnauthorized
	}
	return resp, nil
}

// Session fetches the JMAP session document.
func (c *Client) Session(ctx context.Context, address, credential, xff string) (*SessionDoc, error) {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	req, err := c.Request(ctx, address, credential, http.MethodGet, c.Base+SessionPath, nil, xff)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: session resource answered %d", ErrUnavailable, resp.StatusCode)
	}
	var d SessionDoc
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&d); err != nil {
		return nil, fmt.Errorf("%w: bad session document: %v", ErrUnavailable, err)
	}
	if d.APIURL == "" {
		return nil, fmt.Errorf("%w: session document has no apiUrl", ErrUnavailable)
	}
	return &d, nil
}

// Call POSTs a (filtered) request body to the advertised apiUrl and returns the
// raw JSON response.
func (c *Client) Call(ctx context.Context, doc *SessionDoc, address, credential, xff string, body []byte) ([]byte, int, error) {
	target, err := c.Resolve(doc.APIURL)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	req, err := c.Request(ctx, address, credential, http.MethodPost, target, bytes.NewReader(body), xff)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return nil, 0, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return data, resp.StatusCode, nil
}
