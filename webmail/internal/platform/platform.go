// Package platform is the client of the platform's webmail agent port
// (spec §2.10): branding, session credentials, password change, invites.
// Every call carries the service key as a Bearer token and has a timeout.
package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Errors a caller distinguishes. Anything else is an upstream failure.
var (
	ErrInvalidCredentials = errors.New("platform: invalid credentials")
	ErrNotFound           = errors.New("platform: not found")
	ErrInvalidToken       = errors.New("platform: invalid or used invite token")
	ErrUnavailable        = errors.New("platform: unavailable")
)

// RateLimitedError is a 429 from the platform.
type RateLimitedError struct{ RetryAfter time.Duration }

func (e *RateLimitedError) Error() string { return "platform: rate limited" }

// PolicyError is a 400/422 with a user-presentable reason (for example a weak
// new password).
type PolicyError struct{ Message string }

func (e *PolicyError) Error() string { return "platform: " + e.Message }

// Branding is the public-safe branding of a mail domain (spec §3.4). It is
// data only: the SPA never receives raw CSS or HTML from an admin.
type Branding struct {
	Name            string       `json:"name"`
	LogoURL         string       `json:"logoUrl,omitempty"`
	Theme           string       `json:"theme,omitempty"`
	Accent          string       `json:"accent,omitempty"`
	LoginTitle      string       `json:"loginTitle,omitempty"`
	LoginMessage    string       `json:"loginMessage,omitempty"`
	SupportEmail    string       `json:"supportEmail,omitempty"`
	SupportURL      string       `json:"supportUrl,omitempty"`
	FooterLinks     []FooterLink `json:"footerLinks,omitempty"`
	DefaultLanguage string       `json:"defaultLanguage,omitempty"`
	AllowUserAccent bool         `json:"allowUserAccent"`

	// The platform's names for two of the fields above (webapp.mk
	// WebmailDomainInfo); Branding() folds them into Name and DefaultLanguage.
	DisplayName   string `json:"displayName,omitempty"`
	DefaultLocale string `json:"defaultLocale,omitempty"`
}

// FooterLink is one footer or help-menu link.
type FooterLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// SessionCredential is what the platform returns for a sign-in.
type SessionCredential struct {
	ID         string    `json:"id"`
	Credential string    `json:"credential"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

// Client talks to the platform.
type Client struct {
	BaseURL string // no trailing slash
	Token   string
	HTTP    *http.Client
	Timeout time.Duration
}

// New returns a client with a sane default transport.
func New(baseURL, token string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), Token: token, Timeout: timeout,
		HTTP: &http.Client{Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment, MaxIdleConnsPerHost: 8, IdleConnTimeout: 60 * time.Second,
			ResponseHeaderTimeout: timeout,
		}}}
}

var domainRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`)

// ValidDomain reports whether s is a plausible DNS name (it is placed in a URL
// path, so anything else is refused).
func ValidDomain(s string) bool { return len(s) <= 253 && domainRe.MatchString(s) }

const maxResp = 1 << 20

func (c *Client) do(ctx context.Context, method, path string, in, out any) (int, http.Header, error) {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return 0, nil, err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, body)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("%w: %s %s: %v", ErrUnavailable, method, path, scrub(err))
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResp))
	if err != nil {
		return resp.StatusCode, resp.Header, fmt.Errorf("%w: reading response: %v", ErrUnavailable, err)
	}
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if out != nil && len(bytes.TrimSpace(data)) > 0 {
			if err := json.Unmarshal(data, out); err != nil {
				return resp.StatusCode, resp.Header, fmt.Errorf("%w: bad response: %v", ErrUnavailable, err)
			}
		}
		return resp.StatusCode, resp.Header, nil
	}
	return resp.StatusCode, resp.Header, statusError(resp, data)
}

// scrub drops the URL from transport errors (it never contains secrets, but
// keeps messages short).
func scrub(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return ue.Err
	}
	return err
}

func statusError(resp *http.Response, data []byte) error {
	var e struct {
		Message string `json:"message"`
		Error   any    `json:"error"`
	}
	_ = json.Unmarshal(data, &e)
	msg := e.Message
	if msg == "" {
		if s, ok := e.Error.(string); ok {
			msg = s
		} else if m, ok := e.Error.(map[string]any); ok {
			msg, _ = m["message"].(string)
		}
	}
	switch resp.StatusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		return ErrInvalidCredentials
	case http.StatusNotFound:
		return ErrNotFound
	case http.StatusGone:
		return ErrInvalidToken
	case http.StatusTooManyRequests:
		ra := 30 * time.Second
		if n, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && n > 0 {
			ra = time.Duration(n) * time.Second
		}
		return &RateLimitedError{RetryAfter: ra}
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		if msg == "" {
			msg = "The request was rejected."
		}
		return &PolicyError{Message: msg}
	}
	return fmt.Errorf("%w: status %d", ErrUnavailable, resp.StatusCode)
}

// Branding fetches the branding of a mail domain. ErrNotFound means the
// domain is not an active mail domain.
func (c *Client) Branding(ctx context.Context, domain string) (*Branding, error) {
	if !ValidDomain(domain) {
		return nil, ErrNotFound
	}
	var b Branding
	if _, _, err := c.do(ctx, http.MethodGet, "/v1/webmail/domains/"+url.PathEscape(domain), nil, &b); err != nil {
		return nil, err
	}
	if b.Name == "" {
		b.Name = b.DisplayName
	}
	if b.DefaultLanguage == "" {
		b.DefaultLanguage = b.DefaultLocale
	}
	// The platform serves the logo on its agent port behind the service token,
	// which the browser does not have: point the browser at our own proxy.
	if strings.HasPrefix(b.LogoURL, "/v1/webmail/") {
		b.LogoURL = "/api/logo?domain=" + url.QueryEscape(domain)
	}
	return &b, nil
}

// maxLogo caps a proxied logo.
const maxLogo = 512 << 10

// Logo fetches a domain's logo from the platform. ErrNotFound when it has none.
func (c *Client) Logo(ctx context.Context, domain string) ([]byte, string, error) {
	if !ValidDomain(domain) {
		return nil, "", ErrNotFound
	}
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/v1/webmail/domains/"+url.PathEscape(domain)+"/logo", nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("%w: logo: %v", ErrUnavailable, scrub(err))
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, "", ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("%w: logo status %d", ErrUnavailable, resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxLogo+1))
	if err != nil || len(data) > maxLogo {
		return nil, "", fmt.Errorf("%w: logo unreadable or too large", ErrUnavailable)
	}
	return data, resp.Header.Get("Content-Type"), nil
}

// CreateSession verifies email+password and returns a session credential. The
// password is forwarded and not kept.
func (c *Client) CreateSession(ctx context.Context, email, password, ip, userAgent string) (*SessionCredential, error) {
	var out SessionCredential
	_, _, err := c.do(ctx, http.MethodPost, "/v1/webmail/sessions",
		map[string]string{"email": email, "password": password, "ip": ip, "userAgent": userAgent}, &out)
	if err != nil {
		if errors.Is(err, ErrNotFound) { // unknown mailbox answers like a wrong password
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if out.Credential == "" {
		return nil, fmt.Errorf("%w: platform returned no credential", ErrUnavailable)
	}
	return &out, nil
}

// RevokeSession revokes one session credential. A credential that is already
// gone is not an error.
func (c *Client) RevokeSession(ctx context.Context, id string) error {
	if id == "" {
		return nil
	}
	_, _, err := c.do(ctx, http.MethodDelete, "/v1/webmail/sessions/"+url.PathEscape(id), nil, nil)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	return err
}

// ChangePassword verifies current and sets next; the platform revokes every
// session credential of the mailbox.
func (c *Client) ChangePassword(ctx context.Context, email, current, next string) error {
	_, _, err := c.do(ctx, http.MethodPost, "/v1/webmail/password",
		map[string]string{"email": email, "current": current, "next": next}, nil)
	if errors.Is(err, ErrNotFound) {
		return ErrInvalidCredentials
	}
	return err
}

// RedeemInvite sets the mailbox password from a single-use invite token.
func (c *Client) RedeemInvite(ctx context.Context, token, password string) error {
	_, _, err := c.do(ctx, http.MethodPost, "/v1/webmail/invites/redeem",
		map[string]string{"token": token, "password": password}, nil)
	if errors.Is(err, ErrNotFound) {
		return ErrInvalidToken
	}
	return err
}

// Health checks the platform's webmail health endpoint.
func (c *Client) Health(ctx context.Context) error {
	_, _, err := c.do(ctx, http.MethodGet, "/v1/webmail/health", nil, nil)
	return err
}
