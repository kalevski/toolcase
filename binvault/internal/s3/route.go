package s3

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
)

// Target is a parsed S3 request address (spec §2.4).
type Target struct {
	Bucket   string
	Key      string // percent-decoded exactly once
	RawPath  string
	RawQuery string
	Query    Query
	// Virtual is true for virtual-hosted-style addressing.
	Virtual bool
	// Service is true for the service root (GET /).
	Service bool
	// Reserved is set for path-style requests whose first segment starts with
	// "_" (binvault's own endpoints); Bucket then holds that segment.
	Reserved bool
}

// HasKey reports whether the request addresses an object (not a bucket).
func (t *Target) HasKey() bool { return t.Key != "" }

// Query is a parsed query string: S3 treats "+" as a space, keeps parameter
// order irrelevant, and has valueless sub-resources such as ?uploads.
type Query map[string][]string

// Has reports whether the parameter is present (even without a value).
func (q Query) Has(k string) bool { _, ok := q[k]; return ok }

// Get returns the first value.
func (q Query) Get(k string) string {
	if v := q[k]; len(v) > 0 {
		return v[0]
	}
	return ""
}

// parseQuery splits a raw query on '&' only (a ';' is ordinary text) and
// unescapes each side once, "+" meaning space.
func parseQuery(raw string) (Query, error) {
	q := Query{}
	if raw == "" {
		return q, nil
	}
	for _, part := range strings.Split(raw, "&") {
		if part == "" {
			continue
		}
		k, v := part, ""
		if i := strings.IndexByte(part, '='); i >= 0 {
			k, v = part[:i], part[i+1:]
		}
		dk, err := url.QueryUnescape(k)
		if err != nil {
			return nil, err
		}
		dv, err := url.QueryUnescape(v)
		if err != nil {
			return nil, err
		}
		q[dk] = append(q[dk], dv)
	}
	return q, nil
}

// ParseTarget splits a request into bucket, key and query. domain is
// BINVAULT_DOMAIN ("" = path-style only).
func ParseTarget(r *http.Request, domain string) (*Target, error) {
	rawPath, rawQuery := httpx.SplitRequestURI(r)
	t := &Target{RawPath: rawPath, RawQuery: rawQuery}
	q, err := parseQuery(rawQuery)
	if err != nil {
		return nil, apierr.New("InvalidArgument", "The query string is not valid percent-encoding.")
	}
	t.Query = q

	if domain != "" {
		host := strings.ToLower(r.Host)
		if i := strings.LastIndexByte(host, ':'); i >= 0 && !strings.HasSuffix(host, "]") {
			host = host[:i]
		}
		host = strings.TrimSuffix(host, ".")
		suffix := "." + strings.ToLower(domain)
		if strings.HasSuffix(host, suffix) && len(host) > len(suffix) {
			t.Virtual = true
			t.Bucket = host[:len(host)-len(suffix)]
			if rawPath != "/" && rawPath != "" {
				// the whole path is the key; exactly one leading slash is syntax
				key, err := url.PathUnescape(strings.TrimPrefix(rawPath, "/"))
				if err != nil {
					return nil, apierr.New("InvalidURI", "Couldn't parse the specified URI.")
				}
				t.Key = key
			}
			return t, nil
		}
	}

	if rawPath == "/" || rawPath == "" {
		t.Service = true
		return t, nil
	}
	rest := strings.TrimPrefix(rawPath, "/")
	seg, tail := rest, ""
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		seg, tail = rest[:i], rest[i+1:]
	}
	bucket, err := url.PathUnescape(seg)
	if err != nil {
		return nil, apierr.New("InvalidURI", "Couldn't parse the specified URI.")
	}
	t.Bucket = bucket
	if strings.HasPrefix(bucket, "_") {
		t.Reserved = true
		return t, nil
	}
	if tail != "" {
		key, err := url.PathUnescape(tail)
		if err != nil {
			return nil, apierr.New("InvalidURI", "Couldn't parse the specified URI.")
		}
		t.Key = key
	}
	return t, nil
}
