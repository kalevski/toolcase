package jmap

import "net/url"

// This file is the seam for everything that depends on the mail server
// implementation (Stalwart is the v1 target; its behaviour is UNVERIFIED here,
// the code follows RFC 8620/8621/9425). If a server differs, change it here.

// SessionPath is where the JMAP session resource lives, relative to the
// server's base URL (RFC 8620 §2.2 well-known URI).
const SessionPath = "/.well-known/jmap"

// BasicUser maps a mailbox address to the HTTP Basic user name the mail server
// expects. Stalwart authenticates by login name, which the platform creates as
// the full address, so the address is used as is.
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
