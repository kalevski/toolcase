package s3

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

// originMatches applies an allowed_origins entry: "*" or a pattern with at most
// one "*" wildcard (S3 semantics).
func originMatches(pattern, origin string) bool {
	if pattern == "*" {
		return true
	}
	i := strings.IndexByte(pattern, '*')
	if i < 0 {
		return pattern == origin
	}
	pre, suf := pattern[:i], pattern[i+1:]
	return len(origin) >= len(pre)+len(suf) && strings.HasPrefix(origin, pre) && strings.HasSuffix(origin, suf)
}

func headerAllowed(allowed []string, h string) bool {
	h = strings.ToLower(strings.TrimSpace(h))
	for _, a := range allowed {
		a = strings.ToLower(a)
		if a == "*" || a == h {
			return true
		}
		if i := strings.IndexByte(a, '*'); i >= 0 && strings.HasPrefix(h, a[:i]) && strings.HasSuffix(h, a[i+1:]) {
			return true
		}
	}
	return false
}

// matchCORS finds the first rule allowing (origin, method) and every requested
// header (preflight only; pass nil for an actual request).
func matchCORS(rules []meta.CORSRule, origin, method string, reqHeaders []string) (*meta.CORSRule, bool) {
	for i := range rules {
		r := &rules[i]
		ok := false
		for _, o := range r.AllowedOrigins {
			if originMatches(o, origin) {
				ok = true
				break
			}
		}
		if !ok {
			continue
		}
		ok = false
		for _, m := range r.AllowedMethods {
			if strings.EqualFold(m, method) {
				ok = true
				break
			}
		}
		if !ok {
			continue
		}
		all := true
		for _, h := range reqHeaders {
			if h != "" && !headerAllowed(r.AllowedHeaders, h) {
				all = false
				break
			}
		}
		if all {
			return r, true
		}
	}
	return nil, false
}

func allowOrigin(r *meta.CORSRule, origin string) string {
	for _, o := range r.AllowedOrigins {
		if o == "*" {
			return "*"
		}
	}
	return origin
}

// preflight answers OPTIONS before authentication from the bucket's rules
// (spec §5.10).
func (s *Server) preflight(rc *reqCtx) {
	r, w := rc.r, rc.w
	b, err := s.bucket(rc.ctx, rc.t.Bucket)
	if err != nil {
		s.writeError(w, r, rc.t, err)
		return
	}
	origin := r.Header.Get("Origin")
	method := r.Header.Get("Access-Control-Request-Method")
	if origin == "" || method == "" {
		s.writeError(w, r, rc.t, apierr.New("BadRequest", "Insufficient information. Origin request header needed.").WithStatus(http.StatusBadRequest))
		return
	}
	var reqHeaders []string
	for _, v := range r.Header.Values("Access-Control-Request-Headers") {
		reqHeaders = append(reqHeaders, strings.Split(v, ",")...)
	}
	rule, ok := matchCORS(b.CORS, origin, method, reqHeaders)
	if !ok {
		msg := "CORSResponse: This CORS request is not allowed. This is usually because the evalution of Origin, request method / Access-Control-Request-Method or Access-Control-Request-Headers are not whitelisted by the resource's CORS spec."
		if len(b.CORS) == 0 {
			msg = "CORSResponse: CORS is not enabled for this bucket."
		}
		s.writeError(w, r, rc.t, accessDenied(msg))
		return
	}
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", allowOrigin(rule, origin))
	h.Set("Access-Control-Allow-Methods", strings.Join(rule.AllowedMethods, ", "))
	if len(reqHeaders) > 0 {
		h.Set("Access-Control-Allow-Headers", strings.TrimSpace(strings.Join(reqHeaders, ", ")))
	}
	if rule.MaxAgeSeconds > 0 {
		h.Set("Access-Control-Max-Age", strconv.Itoa(rule.MaxAgeSeconds))
	}
	if len(rule.ExposeHeaders) > 0 {
		h.Set("Access-Control-Expose-Headers", strings.Join(rule.ExposeHeaders, ", "))
	}
	h.Add("Vary", "Origin")
	h.Add("Vary", "Access-Control-Request-Headers")
	h.Add("Vary", "Access-Control-Request-Method")
	w.WriteHeader(http.StatusOK)
}

// applyCORS adds the CORS headers of an actual response for a matching origin.
func applyCORS(w http.ResponseWriter, r *http.Request, b *meta.Bucket) {
	origin := r.Header.Get("Origin")
	if origin == "" || len(b.CORS) == 0 {
		return
	}
	rule, ok := matchCORS(b.CORS, origin, r.Method, nil)
	if !ok {
		return
	}
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", allowOrigin(rule, origin))
	h.Add("Vary", "Origin")
	if len(rule.ExposeHeaders) > 0 {
		h.Set("Access-Control-Expose-Headers", strings.Join(rule.ExposeHeaders, ", "))
	}
}

// getCORS is the read-only GetBucketCors view.
func (s *Server) getCORS(rc *reqCtx) error {
	if len(rc.b.CORS) == 0 {
		return apierr.New("NoSuchCORSConfiguration", "The CORS configuration does not exist.")
	}
	rules := make([]s3xml.CORSRule, len(rc.b.CORS))
	for i, r := range rc.b.CORS {
		rules[i] = s3xml.CORSRule{
			AllowedHeaders: r.AllowedHeaders, AllowedMethods: r.AllowedMethods, AllowedOrigins: r.AllowedOrigins,
			ExposeHeaders: r.ExposeHeaders, MaxAgeSeconds: r.MaxAgeSeconds,
		}
	}
	return s.writeXML(rc, http.StatusOK, s3xml.CORSXML(rules))
}

// getLifecycle is the read-only GetBucketLifecycleConfiguration view.
func (s *Server) getLifecycle(rc *reqCtx) error {
	if len(rc.b.Lifecycle) == 0 {
		return apierr.New("NoSuchLifecycleConfiguration", "The lifecycle configuration does not exist.")
	}
	rules := make([]s3xml.LifecycleRule, len(rc.b.Lifecycle))
	for i, r := range rc.b.Lifecycle {
		rules[i] = s3xml.LifecycleRule{
			ID: r.ID, Enabled: r.IsEnabled(), Prefix: r.Filter.Prefix, Tags: r.Filter.Tags,
			MinSize: r.Filter.MinSize, MaxSize: r.Filter.MaxSize, ExpireDays: r.ExpireDays,
			ExpireDeleteMarkers: r.ExpireDeleteMarkers, NoncurrentDays: r.NoncurrentDays,
			NoncurrentKeep: r.NoncurrentKeep, AbortMultipartDays: r.AbortMultipartDays,
		}
	}
	return s.writeXML(rc, http.StatusOK, s3xml.LifecycleXML(rules))
}
