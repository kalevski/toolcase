package config

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// AdvancedScope is where an advanced snippet is rendered. The server-level
// escape hatch of a site, app, redirect or dead host is the strictest; a proxy
// (server or location level) may also tune its upstream timeouts.
type AdvancedScope int

const (
	AdvancedSite AdvancedScope = iota
	AdvancedProxy
)

// MaxAdvancedSize bounds one snippet.
const MaxAdvancedSize = 16 << 10

const maxAdvancedBodySize = 1 << 30

var (
	advHeaderNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]*$`)
	advExpiresRe    = regexp.MustCompile(`^(off|epoch|max|[@+-]?[0-9]+(ms|s|m|h|d|w|M|y)?|-1)$`)
	advSizeRe       = regexp.MustCompile(`^([0-9]+)([kKmMgG]?)$`)
	advTimeRe       = regexp.MustCompile(`^([0-9]+)(ms|s|m|h)?$`)
	advGzipRe       = regexp.MustCompile(`^gzip(_[a-z_]+)?$`)
	advCharsetRe    = regexp.MustCompile(`^(off|[A-Za-z0-9._-]+)$`)
	advTokenRe      = regexp.MustCompile(`^[A-Za-z0-9._*+/-]+$`)
	advCodeRe       = regexp.MustCompile(`^[1-5][0-9][0-9]$`)
)

// advancedFSRoots are filesystem roots that a snippet value may not name: no
// allowlisted directive needs a host path, and a value beginning with one is
// the shape of every file-disclosure payload.
var advancedFSRoots = []string{
	"/etc", "/var", "/usr", "/proc", "/sys", "/run", "/root", "/home", "/tmp",
	"/dev", "/opt", "/bin", "/sbin", "/lib", "/lib64", "/srv", "/mnt", "/boot", "/media",
}

type advancedDirective func(args []string, scope AdvancedScope) error

var advancedDirectives = map[string]advancedDirective{
	"add_header":           advAddHeader,
	"expires":              advExpires,
	"rewrite":              advRewrite,
	"return":               advReturn,
	"error_page":           advErrorPage,
	"client_max_body_size": advBodySize,
	"charset":              advOneArg(advCharsetRe, "a charset name or off"),
	"charset_types":        advManyTokens,
	"etag":                 advOnOff,
	"access_log":           advAccessLogOff,
}

var advancedProxyDirectives = map[string]advancedDirective{
	"proxy_read_timeout":      advTimeout,
	"proxy_send_timeout":      advTimeout,
	"proxy_connect_timeout":   advTimeout,
	"proxy_buffering":         advOnOff,
	"proxy_request_buffering": advOnOff,
}

// ValidateAdvanced checks a raw nginx snippet before it is rendered verbatim
// into a server or location block. It tokenizes the text (quote-aware), refuses
// braces, comments and escapes outright, and accepts only an allowlist of
// directives with validated arguments: whatever else a snippet could do — close
// the block, include a file, alias a directory, proxy to a socket — is
// unreachable because the directive is not on the list.
func ValidateAdvanced(text string, scope AdvancedScope) error {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	if len(text) > MaxAdvancedSize {
		return fmt.Errorf("advanced: snippet is %d bytes, the maximum is %d", len(text), MaxAdvancedSize)
	}
	stmts, err := splitAdvanced(text)
	if err != nil {
		return fmt.Errorf("advanced: %w", err)
	}
	for _, args := range stmts {
		name := args[0]
		fn, ok := advancedDirectives[name]
		if !ok && advGzipRe.MatchString(name) {
			fn, ok = advGzip, true
		}
		if !ok && scope == AdvancedProxy {
			fn, ok = advancedProxyDirectives[name]
		}
		if !ok {
			return fmt.Errorf("advanced: directive %q is not allowed (allowed: %s)", name, strings.Join(allowedAdvancedNames(scope), ", "))
		}
		for _, a := range args[1:] {
			if err := advCheckValue(a); err != nil {
				return fmt.Errorf("advanced: %s: %w", name, err)
			}
		}
		if err := fn(args[1:], scope); err != nil {
			return fmt.Errorf("advanced: %s: %w", name, err)
		}
	}
	return nil
}

func allowedAdvancedNames(scope AdvancedScope) []string {
	names := []string{"gzip*"}
	for n := range advancedDirectives {
		names = append(names, n)
	}
	if scope == AdvancedProxy {
		for n := range advancedProxyDirectives {
			names = append(names, n)
		}
	}
	sort.Strings(names)
	return names
}

// splitAdvanced tokenizes into statements (each a slice of unquoted words, the
// directive name first). Braces, '#' comments and backslashes outside quotes
// are refused, the last statement must end with ';', and quotes must balance.
func splitAdvanced(text string) ([][]string, error) {
	var (
		stmts [][]string
		cur   []string
		tok   strings.Builder
		inTok bool
		quote byte
		after bool
	)
	endTok := func() {
		if inTok {
			cur = append(cur, tok.String())
			tok.Reset()
			inTok = false
		}
		after = false
	}
	for i := 0; i < len(text); i++ {
		c := text[i]
		if c < 0x20 && c != '\n' && c != '\r' && c != '\t' || c == 0x7f {
			return nil, fmt.Errorf("control character 0x%02x is not allowed", c)
		}
		if c == '{' || c == '}' {
			return nil, fmt.Errorf("braces are not allowed")
		}
		if quote != 0 {
			switch {
			case c == '\\' && i+1 < len(text):
				if text[i+1] == '{' || text[i+1] == '}' {
					return nil, fmt.Errorf("braces are not allowed")
				}
				tok.WriteByte(c)
				tok.WriteByte(text[i+1])
				i++
			case c == '\n' || c == '\r':
				return nil, fmt.Errorf("a quoted value must not span lines")
			case c == quote:
				quote = 0
				after = true
			default:
				tok.WriteByte(c)
			}
			continue
		}
		switch {
		case after && c != ';' && c != ' ' && c != '\t' && c != '\n' && c != '\r':
			return nil, fmt.Errorf("unexpected %q after a closing quote", string(c))
		case c == '\\':
			return nil, fmt.Errorf("backslash escapes outside quotes are not allowed")
		case c == '#':
			return nil, fmt.Errorf("comments are not allowed")
		case c == '"' || c == '\'':
			if inTok {
				return nil, fmt.Errorf("a quote must start a value")
			}
			quote, inTok = c, true
		case c == ';':
			endTok()
			if len(cur) == 0 {
				return nil, fmt.Errorf("empty statement")
			}
			stmts = append(stmts, cur)
			cur = nil
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			endTok()
		default:
			tok.WriteByte(c)
			inTok = true
		}
	}
	if quote != 0 {
		return nil, fmt.Errorf("unterminated quote")
	}
	endTok()
	if len(cur) != 0 {
		return nil, fmt.Errorf("the last directive must end with ';'")
	}
	return stmts, nil
}

// advCheckValue rejects the filesystem-shaped values: any "..", and an absolute
// host path (a value that begins with a system directory).
func advCheckValue(v string) error {
	if strings.Contains(v, "..") {
		return fmt.Errorf("value %q must not contain ..", v)
	}
	for _, root := range advancedFSRoots {
		if v == root || strings.HasPrefix(v, root+"/") {
			return fmt.Errorf("value %q names a filesystem path", v)
		}
	}
	return nil
}

func advAddHeader(args []string, _ AdvancedScope) error {
	if len(args) < 2 || len(args) > 3 {
		return fmt.Errorf("expected: name value [always]")
	}
	if !advHeaderNameRe.MatchString(args[0]) {
		return fmt.Errorf("header name %q is not a plain token", args[0])
	}
	if len(args) == 3 && args[2] != "always" {
		return fmt.Errorf("the third argument must be \"always\"")
	}
	return nil
}

func advExpires(args []string, _ AdvancedScope) error {
	switch len(args) {
	case 1:
	case 2:
		if args[0] != "modified" {
			return fmt.Errorf("expected: [modified] time")
		}
		args = args[1:]
	default:
		return fmt.Errorf("expected: [modified] time")
	}
	if !advExpiresRe.MatchString(args[0]) {
		return fmt.Errorf("%q is not a time, off, epoch or max", args[0])
	}
	return nil
}

func advRewrite(args []string, _ AdvancedScope) error {
	if len(args) < 2 || len(args) > 3 {
		return fmt.Errorf("expected: regex replacement [last|break|redirect|permanent]")
	}
	if len(args) == 3 {
		switch args[2] {
		case "last", "break", "redirect", "permanent":
		default:
			return fmt.Errorf("flag %q must be last | break | redirect | permanent", args[2])
		}
	}
	return advRelativeOrHTTPS(args[1])
}

func advReturn(args []string, _ AdvancedScope) error {
	if len(args) < 1 || len(args) > 2 {
		return fmt.Errorf("expected: code [text|URL]")
	}
	code, err := strconv.Atoi(args[0])
	if err != nil || code < 300 || code > 599 {
		return fmt.Errorf("code %q must be a 3xx, 4xx or 5xx status", args[0])
	}
	if code < 400 {
		if len(args) != 2 {
			return fmt.Errorf("a %d needs a target URL", code)
		}
		return advRelativeOrHTTPS(args[1])
	}
	return nil
}

func advErrorPage(args []string, _ AdvancedScope) error {
	if len(args) < 2 {
		return fmt.Errorf("expected: code ... [=[response]] uri")
	}
	for _, a := range args[:len(args)-1] {
		if advCodeRe.MatchString(a) || strings.HasPrefix(a, "=") {
			continue
		}
		return fmt.Errorf("%q is not a status code", a)
	}
	return advRelativeOrHTTPS(args[len(args)-1])
}

func advRelativeOrHTTPS(target string) error {
	if strings.HasPrefix(target, "/") || strings.HasPrefix(target, "https://") || strings.HasPrefix(target, "$scheme://") {
		return nil
	}
	return fmt.Errorf("target %q must be a relative path or an https:// URL", target)
}

func advBodySize(args []string, _ AdvancedScope) error {
	if len(args) != 1 {
		return fmt.Errorf("expected one size")
	}
	m := advSizeRe.FindStringSubmatch(args[0])
	if m == nil {
		return fmt.Errorf("%q is not a size like 10m", args[0])
	}
	n, _ := strconv.ParseInt(m[1], 10, 64)
	switch strings.ToLower(m[2]) {
	case "k":
		n <<= 10
	case "m":
		n <<= 20
	case "g":
		n <<= 30
	}
	if n <= 0 || n > maxAdvancedBodySize {
		return fmt.Errorf("size %q must be between 1 byte and 1g (0 means unlimited and is not allowed)", args[0])
	}
	return nil
}

func advTimeout(args []string, _ AdvancedScope) error {
	if len(args) != 1 {
		return fmt.Errorf("expected one time")
	}
	m := advTimeRe.FindStringSubmatch(args[0])
	if m == nil {
		return fmt.Errorf("%q is not a time like 300s", args[0])
	}
	n, _ := strconv.ParseInt(m[1], 10, 64)
	unit := map[string]int64{"": 1000, "ms": 1, "s": 1000, "m": 60000, "h": 3600000}[m[2]]
	if n*unit > 3600000 {
		return fmt.Errorf("%q exceeds the 1h maximum", args[0])
	}
	return nil
}

func advOnOff(args []string, _ AdvancedScope) error {
	if len(args) != 1 || (args[0] != "on" && args[0] != "off") {
		return fmt.Errorf("expected on or off")
	}
	return nil
}

func advAccessLogOff(args []string, _ AdvancedScope) error {
	if len(args) != 1 || args[0] != "off" {
		return fmt.Errorf("only \"access_log off\" is allowed")
	}
	return nil
}

func advGzip(args []string, _ AdvancedScope) error {
	if len(args) == 0 {
		return fmt.Errorf("expected an argument")
	}
	for _, a := range args {
		if !advTokenRe.MatchString(a) && a != "~*" && !strings.HasPrefix(a, "msie") {
			return fmt.Errorf("argument %q is not a plain token", a)
		}
	}
	return nil
}

func advManyTokens(args []string, _ AdvancedScope) error {
	if len(args) == 0 {
		return fmt.Errorf("expected at least one argument")
	}
	for _, a := range args {
		if !advTokenRe.MatchString(a) {
			return fmt.Errorf("argument %q is not a plain token", a)
		}
	}
	return nil
}

func advOneArg(re *regexp.Regexp, what string) advancedDirective {
	return func(args []string, _ AdvancedScope) error {
		if len(args) != 1 || !re.MatchString(args[0]) {
			return fmt.Errorf("expected %s", what)
		}
		return nil
	}
}
