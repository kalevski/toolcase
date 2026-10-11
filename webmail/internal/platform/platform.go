// Package platform is webmail's one call back to the hosting platform: a
// mailbox owner's password change. Stalwart 0.16 does not let a mailbox change
// its own password, so the platform checks the current one and sets the new one
// with its administrator credential. It authenticates with WEBMAIL_API_TOKEN,
// the same secret the platform uses to call webmail.
package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/jmap"
)

// PasswordPath is the platform's endpoint on its agent URL.
const PasswordPath = "/v1/webmail/password"

// Client calls the platform.
type Client struct {
	Base  string // WEBMAIL_PLATFORM_URL, no trailing slash
	Token string // WEBMAIL_API_TOKEN
	HTTP  *http.Client
}

// New returns a client with a bounded timeout: the platform waits for the mail
// server three times (check, set, confirm).
func New(base, token string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &Client{Base: strings.TrimRight(base, "/"), Token: token, HTTP: &http.Client{Timeout: 4 * timeout}}
}

// ChangePassword asks the platform to change address's password. The errors
// match jmap.Client.ChangePassword: a wrong current password is
// jmap.ErrUnauthorized, a refused new one a *jmap.PolicyError, an acknowledged
// change that did not take jmap.ErrNotApplied, anything else jmap.ErrUnavailable.
func (c *Client) ChangePassword(ctx context.Context, address, current, next, _ string) error {
	body, _ := json.Marshal(map[string]string{"address": address, "current": current, "next": next})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Base+PasswordPath, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("%w: platform: %v", jmap.ErrUnavailable, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	var answer struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(data, &answer)
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	case resp.StatusCode == http.StatusForbidden && answer.Error == "invalid_credentials":
		return jmap.ErrUnauthorized
	case resp.StatusCode == http.StatusUnprocessableEntity:
		message := answer.Message
		if message == "" || len(message) > 300 {
			message = "The new password was not accepted."
		}
		return &jmap.PolicyError{Message: message}
	case resp.StatusCode == http.StatusBadGateway && answer.Error == "password_not_applied":
		return jmap.ErrNotApplied
	case resp.StatusCode == http.StatusUnauthorized:
		return fmt.Errorf("%w: the platform refused WEBMAIL_API_TOKEN", jmap.ErrUnavailable)
	}
	return fmt.Errorf("%w: platform answered %d", jmap.ErrUnavailable, resp.StatusCode)
}
