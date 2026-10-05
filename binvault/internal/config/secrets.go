package config

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode"
	"unicode/utf8"
)

// The secret variables are BINVAULT_ADMIN_TOKEN, BINVAULT_MASTER_KEY,
// BINVAULT_MASTER_KEY_OLD and BINVAULT_CLUSTER_KEY (§2.3). Messages about them
// give entry positions, lengths and file paths, never a value.
const (
	// minAdminToken is the shortest admin token, in characters (§2.3, §10).
	minAdminToken = 32
	// minClusterKey is the shortest cluster key, in bytes (§8.3).
	minClusterKey = 32
	// masterKeyLen is the decoded size of a master key (§4.7).
	masterKeyLen = 32
	// maxSecretFile caps how much of a _FILE secret is read, so that a path
	// such as /dev/urandom fails instead of hanging the boot.
	maxSecretFile = 64 << 10
	// redacted stands in for a secret value.
	redacted = "***"
)

// secretState is the outcome of reading a secret variable.
type secretState int

const (
	secretUnset secretState = iota // neither form is set
	secretBad                      // set, and a problem has been reported
	secretOK                       // set and read
)

// secret reads a secret from its plain or its _FILE form and returns it with
// the name of the variable it came from, for messages. Setting both forms is
// a problem. A file's contents lose their trailing whitespace (the newline
// that editors and echo add) and must not then be empty; after that they are
// parsed exactly like the plain form.
func (l *loader) secret(name string) (value, from string, st secretState) {
	fileVar := name + fileSuffix
	raw, inEnv := l.env(name)
	path, inFile := l.env(fileVar)
	switch {
	case inEnv && inFile:
		l.fail(name, "is set together with %s: set only one of them", fileVar)
		return "", "", secretBad
	case inEnv:
		if strings.TrimSpace(raw) == "" {
			l.fail(name, "is set but empty")
			return "", "", secretBad
		}
		l.applied[name] = redacted
		return raw, name, secretOK
	case inFile:
		path = strings.TrimSpace(path)
		if path == "" {
			l.fail(fileVar, "is set but empty")
			return "", "", secretBad
		}
		l.applied[fileVar] = path
		data, err := readSecretFile(path)
		if err != nil {
			l.fail(fileVar, "%v", err)
			return "", "", secretBad
		}
		return data, fileVar, secretOK
	}
	return "", "", secretUnset
}

// readSecretFile returns a secret file's contents without trailing
// whitespace. Errors name the path, never the contents.
func readSecretFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("cannot read the secret file: %v", err)
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxSecretFile+1))
	if err != nil {
		return "", fmt.Errorf("cannot read the secret file: %v", err)
	}
	if len(data) > maxSecretFile {
		return "", fmt.Errorf("the secret file %s is larger than 64 KiB; is it the right file?", path)
	}
	s := strings.TrimRightFunc(string(data), unicode.IsSpace)
	if s == "" {
		return "", fmt.Errorf("the secret file %s is empty", path)
	}
	return s, nil
}

// splitSecret splits a comma-separated secret into entries trimmed of
// surrounding whitespace, so "old, new" works. Empty entries are kept, to be
// reported by position.
func splitSecret(v string) []string {
	parts := strings.Split(v, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}

// label names entry n of a list of total entries in a message ("token 2 "),
// or nothing when the list has a single entry.
func label(noun string, n, total int) string {
	if total == 1 {
		return ""
	}
	return fmt.Sprintf("%s %d ", noun, n)
}

// hasControl reports whether s contains a control character. Admin tokens and
// cluster keys travel in HTTP headers, which cannot carry them, and a line
// break usually means several secrets were put on separate lines instead of
// being separated by commas.
func hasControl(s string) bool { return strings.ContainsFunc(s, unicode.IsControl) }

// adminToken parses BINVAULT_ADMIN_TOKEN (§4.2): one or more comma-separated
// tokens of at least 32 characters, no two alike.
func (l *loader) adminToken() {
	v, from, st := l.secret(envAdminToken)
	switch st {
	case secretUnset:
		l.fail(envAdminToken, "is required (or %s%s): at least %d characters, for example from `openssl rand -hex 32`",
			envAdminToken, fileSuffix, minAdminToken)
		return
	case secretBad:
		return
	}
	entries := splitSecret(v)
	seen := make(map[string]int, len(entries))
	var tokens []string
	for i, t := range entries {
		n, at := i+1, label("token", i+1, len(entries))
		chars := utf8.RuneCountInString(t)
		switch first, dup := seen[t]; {
		case t == "":
			l.fail(from, "%sis empty (stray comma?)", at)
		case hasControl(t):
			l.fail(from, "%scontains a control character such as a line break (separate several tokens with commas)", at)
		case chars < minAdminToken:
			l.fail(from, "%sis %d characters long; at least %d are required", at, chars, minAdminToken)
		case dup:
			l.fail(from, "tokens %d and %d are identical", first, n)
		default:
			seen[t] = n
			tokens = append(tokens, t)
		}
	}
	l.c.AdminToken = tokens
}

// masterKeys parses BINVAULT_MASTER_KEY and BINVAULT_MASTER_KEY_OLD (§4.7):
// base64 of exactly 32 bytes each, all distinct.
func (l *loader) masterKeys() {
	v, from, st := l.secret(envMasterKey)
	switch st {
	case secretUnset:
		l.fail(envMasterKey, "is required (or %s%s): base64 of %d random bytes, for example from `openssl rand -base64 32`",
			envMasterKey, fileSuffix, masterKeyLen)
	case secretOK:
		if key, problem := decodeMasterKey(v); problem != "" {
			l.fail(from, "%s", problem)
		} else {
			l.c.MasterKey = key
		}
	}

	v, from, st = l.secret(envMasterKeyOld)
	if st != secretOK {
		return
	}
	entries := splitSecret(v)
	var old [][]byte
	positions := make([]int, 0, len(entries))
	for i, e := range entries {
		n, at := i+1, label("key", i+1, len(entries))
		if e == "" {
			l.fail(from, "%sis empty (stray comma?)", at)
			continue
		}
		key, problem := decodeMasterKey(e)
		if problem != "" {
			l.fail(from, "%s%s", at, problem)
			continue
		}
		if l.c.MasterKey != nil && bytes.Equal(key, l.c.MasterKey) {
			l.fail(from, "%sis the current %s; list only the previous keys", at, envMasterKey)
			continue
		}
		dup := false
		for j, k := range old {
			if bytes.Equal(k, key) {
				l.fail(from, "keys %d and %d are the same key", positions[j], n)
				dup = true
				break
			}
		}
		if !dup {
			old = append(old, key)
			positions = append(positions, n)
		}
	}
	l.c.MasterKeyOld = old
}

// decodeMasterKey decodes a master key given in standard or URL-safe base64,
// padded or not, and checks that it is 32 bytes. The problem it returns
// describes the value without quoting it.
func decodeMasterKey(s string) ([]byte, string) {
	s = strings.TrimSpace(s)
	const want = "it must be base64 of exactly 32 random bytes, for example from `openssl rand -base64 32`"
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		key, err := enc.DecodeString(s)
		if err != nil {
			continue
		}
		if len(key) != masterKeyLen {
			hint := ""
			if len(s) == 2*masterKeyLen && strings.Trim(strings.ToLower(s), "0123456789abcdef") == "" {
				hint = " (it looks like hex)"
			}
			return nil, fmt.Sprintf("decodes to %d bytes%s; %s", len(key), hint, want)
		}
		return key, ""
	}
	return nil, "is not valid base64; " + want
}

// clusterKey parses BINVAULT_CLUSTER_KEY (§8.3): one or more comma-separated
// keys of at least 32 bytes, no two alike; the first is the one a node sends.
func (l *loader) clusterKey() {
	v, from, st := l.secret(envClusterKey)
	switch st {
	case secretUnset:
		l.fail(envClusterKey, "is required when %s is set (or %s%s): a shared secret of at least %d bytes, identical on every node",
			envClusterURLs, envClusterKey, fileSuffix, minClusterKey)
		return
	case secretBad:
		return
	}
	entries := splitSecret(v)
	seen := make(map[string]int, len(entries))
	var keys [][]byte
	for i, k := range entries {
		n, at := i+1, label("key", i+1, len(entries))
		switch first, dup := seen[k]; {
		case k == "":
			l.fail(from, "%sis empty (stray comma?)", at)
		case hasControl(k):
			l.fail(from, "%scontains a control character such as a line break (separate several keys with commas)", at)
		case len(k) < minClusterKey:
			l.fail(from, "%sis %d bytes long; at least %d are required", at, len(k), minClusterKey)
		case dup:
			l.fail(from, "keys %d and %d are identical", first, n)
		default:
			seen[k] = n
			keys = append(keys, []byte(k))
		}
	}
	l.c.ClusterKey = keys
}
