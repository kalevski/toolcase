package engine

import (
	"mime"
	"net/url"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// MaxKeyBytes is the longest object key (spec §3.8).
const MaxKeyBytes = 1024

// ValidateKey checks an object key (spec §3.7).
func ValidateKey(key string) error {
	if len(key) == 0 {
		return apierr.New("InvalidArgument", "Object key must not be empty.")
	}
	if len(key) > MaxKeyBytes {
		return apierr.New("KeyTooLongError", "Your key is too long.")
	}
	if !utf8.ValidString(key) {
		return apierr.New("InvalidArgument", "Object key must be valid UTF-8.")
	}
	if strings.IndexByte(key, 0) >= 0 {
		return apierr.New("InvalidArgument", "Object key must not contain NUL.")
	}
	return nil
}

var bucketRe = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`)
var ipv4Re = regexp.MustCompile(`^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$`)

// ValidateBucketName applies the naming rules of spec §3.7. domainSet says
// whether BINVAULT_DOMAIN is configured (then dots are refused).
func ValidateBucketName(name string, domainSet bool) error {
	switch {
	case !bucketRe.MatchString(name):
		return apierr.New("InvalidBucketName", "Bucket names are 3-63 characters of lowercase letters, digits, hyphens and dots, starting and ending with a letter or digit.")
	case strings.Contains(name, ".."):
		return apierr.New("InvalidBucketName", "Bucket names must not contain two adjacent dots.")
	case ipv4Re.MatchString(name):
		return apierr.New("InvalidBucketName", "Bucket names must not be formatted as an IP address.")
	case strings.HasPrefix(name, "_"):
		return apierr.New("InvalidBucketName", "Bucket names must not start with an underscore.")
	case domainSet && strings.Contains(name, "."):
		return apierr.New("InvalidBucketName", "Bucket names must not contain dots while a virtual-host domain is configured.")
	}
	return nil
}

// MaxMetadataBytes is the user-metadata budget per object (spec §3.8).
const MaxMetadataBytes = 2048

// ValidateMetadata checks x-amz-meta-* names (already lower-cased) and values.
func ValidateMetadata(md map[string]string) error {
	total := 0
	for k, v := range md {
		total += len(k) + len(v)
		for i := 0; i < len(v); i++ {
			if v[i] > 0x7e || (v[i] < 0x20 && v[i] != '\t') {
				return apierr.New("InvalidArgument", "User metadata values must be US-ASCII.")
			}
		}
		for i := 0; i < len(k); i++ {
			c := k[i]
			if c <= 0x20 || c >= 0x7f || c == ':' {
				return apierr.New("InvalidArgument", "Invalid user metadata name.")
			}
		}
	}
	if total > MaxMetadataBytes {
		return apierr.New("MetadataTooLarge", "Your metadata headers exceed the maximum allowed metadata size.")
	}
	return nil
}

// ValidateTags checks an object tag set (spec §3.8, §5.7).
func ValidateTags(tags map[string]string) error {
	if len(tags) > 10 {
		return apierr.New("InvalidTag", "Object tags cannot be greater than 10.")
	}
	for k, v := range tags {
		if k == "" {
			return apierr.New("InvalidTag", "The TagKey you have provided is empty.")
		}
		if utf8.RuneCountInString(k) > 128 {
			return apierr.New("InvalidTag", "The TagKey you have provided is too long.")
		}
		if utf8.RuneCountInString(v) > 256 {
			return apierr.New("InvalidTag", "The TagValue you have provided is too long.")
		}
		if !tagText(k) || !tagText(v) {
			return apierr.New("InvalidTag", "The tag provided contains invalid characters.")
		}
		if strings.HasPrefix(strings.ToLower(k), "aws:") {
			return apierr.New("InvalidTag", "Your TagKey cannot be prefixed with aws:.")
		}
	}
	return nil
}

// tagText applies S3's tag syntax, [\p{L}\p{Z}\p{N}_.:/=+\-@]*: letters, numbers,
// separator spaces (U+0020 and the other Z characters; not tab, CR or LF, which
// are controls) and + - = . _ : / @.
func tagText(s string) bool {
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.Is(unicode.Z, r) {
			continue
		}
		switch r {
		case '+', '-', '=', '.', '_', ':', '/', '@':
			continue
		}
		return false
	}
	return true
}

// ParseTagging parses the x-amz-tagging header value (k=v&k2=v2, URL-encoded).
func ParseTagging(s string) (map[string]string, error) {
	if s == "" {
		return nil, nil
	}
	vals, err := url.ParseQuery(s)
	if err != nil {
		return nil, apierr.New("InvalidTag", "The x-amz-tagging header is malformed.")
	}
	out := make(map[string]string, len(vals))
	for k, v := range vals {
		if len(v) != 1 {
			return nil, apierr.New("InvalidTag", "Duplicate tag key.")
		}
		out[k] = v[0]
	}
	return out, ValidateTags(out)
}

// MediaType strips parameters from a Content-Type and lower-cases it.
func MediaType(ct string) string {
	if ct == "" {
		return ""
	}
	if mt, _, err := mime.ParseMediaType(ct); err == nil {
		return mt
	}
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = ct[:i]
	}
	return strings.ToLower(strings.TrimSpace(ct))
}

// TypeAllowed applies a bucket's allowed_content_types patterns to a sniffed
// type (spec §3.13): case-insensitive, parameters ignored, "*" or "type/*"
// wildcards. An empty list allows everything.
func TypeAllowed(patterns []string, sniffed string) bool {
	if len(patterns) == 0 {
		return true
	}
	mt := MediaType(sniffed)
	for _, p := range patterns {
		p = strings.ToLower(strings.TrimSpace(p))
		switch {
		case p == "*" || p == "*/*":
			return true
		case strings.HasSuffix(p, "/*"):
			if strings.HasPrefix(mt, p[:len(p)-1]) {
				return true
			}
		case p == mt:
			return true
		}
	}
	return false
}

// ValidatePatterns checks allowed_content_types syntax (admin API).
func ValidatePatterns(patterns []string) error {
	if len(patterns) > 100 {
		return apierr.New("InvalidArgument", "At most 100 allowed_content_types patterns.")
	}
	for _, p := range patterns {
		p = strings.TrimSpace(p)
		if p == "*" || p == "*/*" {
			continue
		}
		i := strings.IndexByte(p, '/')
		if i <= 0 || i == len(p)-1 || strings.ContainsAny(p, " ;,") || strings.Count(p, "/") != 1 {
			return apierr.Newf("InvalidArgument", "Bad content type pattern %q.", p)
		}
		if strings.Contains(p[:i], "*") || (strings.Contains(p[i+1:], "*") && p[i+1:] != "*") {
			return apierr.Newf("InvalidArgument", "Bad content type pattern %q: '*' is allowed only as the whole subtype.", p)
		}
	}
	return nil
}
