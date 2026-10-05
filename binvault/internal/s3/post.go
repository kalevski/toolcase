package s3

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// maxPostFields bounds the form fields other than the file (spec §5.4.9).
const maxPostFields = 20 << 10

// maxPolicyLife is how far ahead a policy's expiration may be (spec §5.4.9).
const maxPolicyLife = 7 * 24 * time.Hour

// postObject implements POST Object (spec §5.4.9): a browser form upload
// authorised by a signed policy. The form is authenticated from its own fields,
// not from the Authorization header, so ServeHTTP lets it through as anonymous.
func (s *Server) postObject(rc *reqCtx) error {
	r := rc.r
	// the form's script must be able to read a refusal as well as the success
	// (spec §5.4.9, §5.10), so the CORS headers go on before anything can fail
	applyCORS(rc.w, r, rc.b)
	if rc.kind != sigv4.None {
		return apierr.New("InvalidArgument", "POST Object forms are authenticated by their policy fields, not by request headers.")
	}
	mt, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mt != "multipart/form-data" || params["boundary"] == "" {
		return apierr.New("MalformedPOSTRequest", "The body of your POST request is not well-formed multipart/form-data.")
	}
	var body io.Reader = httpx.NewIdleReader(rc.w, r.Body, s.Cfg.BodyIdleTimeout, rc.info)
	mr := multipart.NewReader(body, params["boundary"])

	fields := map[string]string{} // lower-cased names
	var order []string
	total := 0
	var filePart *multipart.Part
	for {
		part, err := mr.NextRawPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return apierr.Wrap("MalformedPOSTRequest", "The body of your POST request is not well-formed multipart/form-data.", err)
		}
		name := strings.ToLower(part.FormName())
		if name == "file" {
			filePart = part
			break
		}
		val, err := io.ReadAll(io.LimitReader(part, maxPostFields+1))
		if err != nil {
			return apierr.Wrap("MalformedPOSTRequest", "The body of your POST request is not well-formed multipart/form-data.", err)
		}
		total += len(name) + len(val)
		if total > maxPostFields {
			return apierr.New("MaxPostPreDataLengthExceededError", "Your POST request fields preceding the upload file were too large.").
				WithExtra("MaxPostPreDataLength", strconv.Itoa(maxPostFields))
		}
		if _, dup := fields[name]; dup {
			return apierr.Newf("InvalidArgument", "POST field %q appears more than once.", name)
		}
		fields[name] = string(val)
		order = append(order, name)
	}
	if filePart == nil {
		return apierr.New("InvalidArgument", "POST requires exactly one file upload per request.")
	}

	// ---- authentication: the signature over the base64 policy ------------------
	policyB64 := fields["policy"]
	cred := fields["x-amz-credential"]
	if policyB64 == "" || cred == "" || fields["x-amz-signature"] == "" {
		return accessDenied("Bucket POST must contain the fields policy, x-amz-credential, x-amz-date and x-amz-signature.")
	}
	if fields["x-amz-algorithm"] != sigv4.Algorithm {
		return apierr.New("InvalidArgument", "x-amz-algorithm must be "+sigv4.Algorithm+".")
	}
	akid, _, _ := strings.Cut(cred, "/")
	var prin *auth.Principal
	var secret string
	if auth.IsPipelineKey(akid) {
		if s.Pipes != nil {
			if p, sec, ok := s.Pipes.Lookup(akid); ok {
				prin, secret = p, sec
			}
		}
	} else if c, err := s.Tokens.Lookup(rc.ctx, akid); err != nil {
		return toAPIError(err)
	} else if c != nil {
		prin, secret = c.Principal(), c.Secret
	}
	pr, verr := sigv4.VerifyPostPolicy(policyB64, cred, fields["x-amz-date"], fields["x-amz-signature"], func(id string) (string, bool) {
		if prin != nil && id == akid {
			return secret, true
		}
		return "", false
	}, s.signOpts())
	if verr != nil {
		s.failAuth(rc, akid, verr)
		return verr
	}
	if prin.Bucket != rc.b.Name {
		return accessDenied("This credential does not belong to this bucket.")
	}
	if prin.Kind == auth.KindPipeline {
		// the form is authenticated inside this handler, past the point where a
		// pipeline token's request is bound to its attempt (so the upload could
		// outlive the token); browser forms are for people, not for services
		return accessDenied("Pipeline tokens cannot upload through POST Object forms.")
	}
	rc.p = prin
	rc.info.Principal = prin.Label()
	if prin.Kind == auth.KindToken {
		s.Tokens.Touch(akid) // only a verified signature counts as use (spec §4.3)
	}
	// ServeHTTP could only charge the form as anonymous (bucket limit); now that
	// the token is known it must pass the token's limits too (spec §4.9)
	if s.Limits != nil && prin.Kind != auth.KindPipeline {
		if ok, wait := s.Limits.Allow(prin, rc.b, time.Now()); !ok {
			s.Metrics.throttled("rate")
			return apierr.New("SlowDown", "Please reduce your request rate.").
				WithHeader("Retry-After", strconv.Itoa(int(wait.Seconds()+0.999)))
		}
	}

	// ---- policy ---------------------------------------------------------------------
	pol, err := parsePostPolicy(pr.Policy)
	if err != nil {
		return err
	}
	if !pol.Expiration.After(time.Now()) {
		return accessDenied("Invalid according to Policy: Policy expired.")
	}
	if pol.Expiration.After(time.Now().Add(maxPolicyLife + time.Minute)) {
		return apierr.New("InvalidPolicyDocument", "Invalid Policy: the expiration may be at most 7 days away.")
	}

	// the final key
	key := fields["key"]
	if key == "" {
		return apierr.New("InvalidArgument", "Bucket POST must contain a field named 'key'.")
	}
	if strings.Contains(key, "${filename}") {
		name := filePart.FileName()
		if i := strings.LastIndexAny(name, `/\`); i >= 0 {
			name = name[i+1:]
		}
		key = strings.ReplaceAll(key, "${filename}", name)
		fields["key"] = key
	}
	if err := engine.ValidateKey(key); err != nil {
		return err
	}

	// every field must be covered by a condition, every condition satisfied
	fields["bucket"] = rc.b.Name
	if err := pol.check(fields, order); err != nil {
		return err
	}

	// ---- authorisation -----------------------------------------------------------------
	tags, err := parsePostTagging(fields["tagging"])
	if err != nil {
		return err
	}
	rc.t.Key = key
	info := rc.info
	info.Key = key
	if acl := fields["acl"]; acl != "" && acl != "private" && acl != "bucket-owner-full-control" {
		return apierr.New("AccessControlListNotSupported", "The bucket does not allow ACLs.")
	}
	hdr := http.Header{}
	for _, f := range order {
		hdr.Set(f, fields[f])
	}
	wh, err := ParseWriteHeaders(hdr)
	if err != nil {
		return err
	}
	if len(tags) == 0 {
		tags = wh.Tags // the x-amz-tagging field is accepted like the header
	}
	// tags from either field need the `tag` action (spec §4.4)
	writeOnce, err := rc.writeAccess(key, len(tags) > 0)
	if err != nil {
		return err
	}
	algo := ""
	checksumWant := ""
	if a, val, found, cerr := checksum.FromHeader(hdr); cerr != nil {
		return cerr
	} else if found {
		algo, checksumWant = string(a), val
	}

	// ---- the file, streamed like a PutObject body ------------------------------------------
	var src io.Reader = filePart
	if s.Limits != nil && prin.Kind != auth.KindPipeline {
		src = s.Limits.WrapReader(rc.ctx, prin, rc.b, src)
	}
	lr := &lengthRange{r: src, min: pol.minLen, max: pol.maxLen}
	res, err := s.Eng.Put(rc.ctx, &engine.PutRequest{
		Bucket: rc.b, Key: key, Body: lr, Size: -1,
		Headers: wh.Headers, Metadata: wh.Metadata, Tags: tags, SSE: wh.SSE,
		ChecksumAlgo: algo,
		Verify: func(rec *engine.Received) error {
			if err := lr.finish(); err != nil {
				return err
			}
			if checksumWant != "" && checksumWant != checksum.Encode(rec.Checksum) {
				return apierr.New("BadDigest", "The "+algo+" you specified did not match the calculated checksum.")
			}
			return nil
		},
		WriteOnce: writeOnce, Actor: rc.actor(), Op: "post",
	})
	if err != nil {
		return err
	}
	return s.postResponse(rc, fields, res)
}

// postResponse answers per success_action_status / success_action_redirect.
func (s *Server) postResponse(rc *reqCtx, fields map[string]string, res *engine.PutResult) error {
	o, h := res.Obj, rc.w.Header()
	h.Set("ETag", quote(o.ETag))
	h.Set("x-binvault-version", o.Version)
	if rc.b.Versioning == meta.VersioningEnabled {
		h.Set("x-amz-version-id", o.S3VersionID())
	}
	if o.SSE {
		h.Set("x-amz-server-side-encryption", "AES256")
	}
	location := strings.TrimRight(s.Cfg.EndpointURL, "/") + "/" + url.PathEscape(rc.b.Name) + "/" + escapeKeyPath(o.Key)
	if redir := fields["success_action_redirect"]; redir != "" {
		u, err := url.Parse(redir)
		if err == nil && (u.Scheme == "http" || u.Scheme == "https") {
			q := u.Query()
			q.Set("bucket", rc.b.Name)
			q.Set("key", o.Key)
			q.Set("etag", quote(o.ETag))
			u.RawQuery = q.Encode()
			h.Set("Location", u.String())
			rc.w.WriteHeader(http.StatusSeeOther)
			return nil
		}
	}
	switch fields["success_action_status"] {
	case "200":
		rc.w.WriteHeader(http.StatusOK)
	case "201":
		h.Set("Location", location)
		return s.writeXML(rc, http.StatusCreated, s3xml.PostResponse{Location: location, Bucket: rc.b.Name, Key: o.Key, ETag: quote(o.ETag)})
	default:
		rc.w.WriteHeader(http.StatusNoContent)
	}
	return nil
}

func parsePostTagging(x string) (map[string]string, error) {
	if strings.TrimSpace(x) == "" {
		return nil, nil
	}
	var doc s3xml.Tagging
	if err := s3xml.Decode(strings.NewReader(x), &doc, 0); err != nil {
		return nil, err
	}
	if err := doc.Validate(); err != nil {
		return nil, err
	}
	tags := doc.Map()
	return tags, engine.ValidateTags(tags)
}

// lengthRange enforces the policy's content-length-range while the body streams.
type lengthRange struct {
	r        io.Reader
	min, max int64 // max < 0 = unbounded
	n        int64
}

func (l *lengthRange) Read(p []byte) (int, error) {
	n, err := l.r.Read(p)
	l.n += int64(n)
	if l.max >= 0 && l.n > l.max {
		return n, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed size.").
			WithExtra("MaxSizeAllowed", strconv.FormatInt(l.max, 10)).WithExtra("ProposedSize", strconv.FormatInt(l.n, 10))
	}
	return n, err
}

func (l *lengthRange) finish() error {
	if l.n < l.min {
		return apierr.New("EntityTooSmall", "Your proposed upload is smaller than the minimum allowed size.").
			WithExtra("MinSizeAllowed", strconv.FormatInt(l.min, 10)).WithExtra("ProposedSize", strconv.FormatInt(l.n, 10))
	}
	return nil
}

// ---- policy documents ---------------------------------------------------------------------

type postCond struct {
	op    string // eq | starts-with
	field string // lower-case, without '$'
	value string
}

type postPolicy struct {
	Expiration time.Time
	conds      []postCond
	minLen     int64
	maxLen     int64 // -1 = unbounded
}

func policyErr(msg string) error { return apierr.New("InvalidPolicyDocument", "Invalid Policy: "+msg) }

func parsePostPolicy(raw []byte) (*postPolicy, error) {
	var doc struct {
		Expiration string            `json:"expiration"`
		Conditions []json.RawMessage `json:"conditions"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, policyErr("the policy is not valid JSON.")
	}
	exp, err := time.Parse(time.RFC3339, doc.Expiration)
	if err != nil {
		return nil, policyErr("the expiration is missing or not an ISO 8601 time.")
	}
	p := &postPolicy{Expiration: exp, maxLen: -1}
	for _, c := range doc.Conditions {
		var obj map[string]string
		if err := json.Unmarshal(c, &obj); err == nil && len(obj) == 1 {
			for k, v := range obj {
				p.conds = append(p.conds, postCond{op: "eq", field: strings.ToLower(k), value: v})
			}
			continue
		}
		var arr []json.RawMessage
		if err := json.Unmarshal(c, &arr); err != nil || len(arr) != 3 {
			return nil, policyErr("a condition must be an object with one field or a three-element array.")
		}
		var op string
		if err := json.Unmarshal(arr[0], &op); err != nil {
			return nil, policyErr("a condition array starts with its operator.")
		}
		switch strings.ToLower(op) {
		case "eq", "starts-with":
			var field, value string
			if json.Unmarshal(arr[1], &field) != nil || json.Unmarshal(arr[2], &value) != nil || !strings.HasPrefix(field, "$") {
				return nil, policyErr("eq and starts-with conditions take a $field and a string value.")
			}
			p.conds = append(p.conds, postCond{op: strings.ToLower(op), field: strings.ToLower(field[1:]), value: value})
		case "content-length-range":
			var lo, hi int64
			if json.Unmarshal(arr[1], &lo) != nil || json.Unmarshal(arr[2], &hi) != nil || lo < 0 || hi < lo {
				return nil, policyErr("content-length-range takes two integers, min <= max.")
			}
			p.minLen, p.maxLen = lo, hi
		default:
			return nil, policyErr(fmt.Sprintf("unknown condition %q.", op))
		}
	}
	return p, nil
}

// check applies every condition to the form and requires every field to be
// covered by one (spec §5.4.9: "Invalid according to Policy: Extra input fields").
func (p *postPolicy) check(fields map[string]string, order []string) error {
	covered := map[string]bool{}
	for _, c := range p.conds {
		covered[c.field] = true
		got, present := fields[c.field]
		if !present && c.field != "bucket" {
			// a condition on a field the form lacks only holds for an empty prefix
			if !(c.op == "starts-with" && c.value == "") {
				return accessDenied(fmt.Sprintf("Invalid according to Policy: Policy Condition failed: %s on %q.", c.op, c.field))
			}
			continue
		}
		switch c.op {
		case "eq":
			if got != c.value {
				return accessDenied(fmt.Sprintf("Invalid according to Policy: Policy Condition failed: [\"eq\", \"$%s\", \"%s\"]", c.field, c.value))
			}
		case "starts-with":
			if !strings.HasPrefix(got, c.value) {
				return accessDenied(fmt.Sprintf("Invalid according to Policy: Policy Condition failed: [\"starts-with\", \"$%s\", \"%s\"]", c.field, c.value))
			}
		}
	}
	for _, f := range order {
		switch {
		case f == "file" || f == "policy" || f == "x-amz-signature" || strings.HasPrefix(f, "x-ignore-"):
		case !covered[f]:
			return accessDenied("Invalid according to Policy: Extra input fields: " + f)
		}
	}
	return nil
}

var _ = base64.StdEncoding
