package jmap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// This file is the seam for everything that depends on the mail server
// implementation (Stalwart is the v1 target; its behaviour is UNVERIFIED here,
// the code follows RFC 8620/8621/9425). If a server differs, change it here.

// SessionPath is where the JMAP session resource lives, relative to the
// server's base URL (RFC 8620 §2.2 well-known URI).
const SessionPath = "/.well-known/jmap"

// BasicUser maps a mailbox address to the HTTP Basic user name the mail server
// expects. Stalwart authenticates by login name, which is the full address, so
// the address is used as is.
func BasicUser(address string) string { return address }

// MailAccountCapability decides which account is "the user's own": the
// primary account for the mail capability (RFC 8621 §1.3.1).
const MailAccountCapability = "urn:ietf:params:jmap:mail"

// Upstream hostnames advertised in the session document (apiUrl, downloadUrl,
// ...) may be the server's public name, unreachable from here, so only their
// path and query are used and they are re-rooted on the configured base URL.
// See Client.Resolve.
func rerootable(u *url.URL) bool { return u.Path != "" }

// AuthResultsHeader is the header property read for the SPF/DKIM/DMARC badge.
const AuthResultsHeader = "header:Authentication-Results:asText"

// AccountAuthPath is where the mail server lets a signed-in user change their
// own password, relative to the server's base URL. UNVERIFIED: this is
// Stalwart's management API as documented for 0.10 to 0.15; 0.16 removed parts
// of it (see the platform's Stalwart driver notes), so check it first.
const AccountAuthPath = "/api/account/auth"

// PolicyError is a refusal of the new password with a presentable reason.
type PolicyError struct{ Message string }

func (e *PolicyError) Error() string { return "jmap: " + e.Message }

// ChangePassword sets a new password for address, authenticating with the
// current one: a wrong current password is ErrUnauthorized, a refused new one a
// *PolicyError. The mail server does the work; nothing else holds the password.
func (c *Client) ChangePassword(ctx context.Context, address, current, next, xff string) error {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	body, _ := json.Marshal([]map[string]string{{"type": "changePassword", "password": next}})
	req, err := c.Request(ctx, address, current, http.MethodPost, c.Base+AccountAuthPath, bytes.NewReader(body), xff)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	case resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity:
		return &PolicyError{Message: refusal(data)}
	}
	return fmt.Errorf("%w: password change answered %d", ErrUnavailable, resp.StatusCode)
}

// refusal pulls a human reason out of an error body, or a generic one.
func refusal(data []byte) string {
	var e struct {
		Message string `json:"message"`
		Detail  string `json:"detail"`
		Error   any    `json:"error"`
	}
	_ = json.Unmarshal(data, &e)
	msg := e.Message
	if msg == "" {
		msg = e.Detail
	}
	if msg == "" {
		switch v := e.Error.(type) {
		case string:
			msg = v
		case map[string]any:
			msg, _ = v["message"].(string)
		}
	}
	if msg == "" || len(msg) > 300 {
		return "The new password was not accepted."
	}
	return msg
}
