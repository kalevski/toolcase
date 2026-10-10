package jmap

import (
	"encoding/json"
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

// AccountAuthPath is where Stalwart 0.10 to 0.15 let a signed-in user change
// their own password, relative to the server's base URL. 0.16 dropped that
// management API; ChangePassword only falls back to it.
const AccountAuthPath = "/api/account/auth"

// StalwartCapability is Stalwart's own JMAP capability. Since 0.16 its
// management objects (x:Domain, x:Account) are JMAP methods under it.
const StalwartCapability = "urn:stalwart:jmap"

// PolicyError is a refusal of the new password with a presentable reason.
type PolicyError struct{ Message string }

func (e *PolicyError) Error() string { return "jmap: " + e.Message }

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
