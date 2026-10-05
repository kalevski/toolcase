package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"hash"
	"io"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// ---- deterministic data: seekable pseudo-random bytes --------------------------------------------------------------------

func splitmix(x uint64) uint64 {
	x += 0x9e3779b97f4a7c15
	x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9
	x = (x ^ (x >> 27)) * 0x94d049bb133111eb
	return x ^ (x >> 31)
}

// fillAt writes the bytes [off, off+len(p)) of the stream identified by seed.
func fillAt(p []byte, seed uint64, off int64) {
	i := 0
	for i < len(p) {
		blk := uint64(off+int64(i)) / 8
		v := splitmix(seed*0x100000001b3 + blk)
		for b := int(uint64(off+int64(i)) % 8); b < 8 && i < len(p); b++ {
			p[i] = byte(v >> (8 * uint(b)))
			i++
		}
	}
}

// genReader streams size bytes of the seed's stream, optionally counting bytes and hashing them.
type genReader struct {
	seed   uint64
	base   int64 // offset in the seed's stream of the first byte
	size   int64
	pos    int64
	sent   *atomic.Int64
	h      hash.Hash
	pace   time.Duration // optional sleep per 1 MiB, to make a transfer long enough to be interrupted
	buf    []byte
	closed bool
}

func newGen(seed uint64, size int64) *genReader { return &genReader{seed: seed, size: size} }

// newGenAt streams bytes [base, base+size) of the seed's stream.
func newGenAt(seed uint64, base, size int64) *genReader {
	return &genReader{seed: seed, base: base, size: size}
}

func (g *genReader) Read(p []byte) (int, error) {
	if g.pos >= g.size {
		return 0, io.EOF
	}
	n := int64(len(p))
	if n > 256<<10 {
		n = 256 << 10
	}
	if g.size-g.pos < n {
		n = g.size - g.pos
	}
	fillAt(p[:n], g.seed, g.base+g.pos)
	if g.h != nil {
		g.h.Write(p[:n])
	}
	g.pos += n
	if g.sent != nil {
		g.sent.Add(n)
	}
	if g.pace > 0 && g.pos%(1<<20) < n {
		time.Sleep(g.pace)
	}
	return int(n), nil
}

// sha256Of computes the SHA-256 of the stream [off, off+size) without storing it.
func sha256Of(seed uint64, off, size int64) string {
	h := sha256.New()
	buf := make([]byte, 1<<20)
	for done := int64(0); done < size; {
		n := int64(len(buf))
		if size-done < n {
			n = size - done
		}
		fillAt(buf[:n], seed, off+done)
		h.Write(buf[:n])
		done += n
	}
	return hex.EncodeToString(h.Sum(nil))
}

func md5Of(seed uint64, off, size int64) string {
	h := md5.New()
	buf := make([]byte, 1<<20)
	for done := int64(0); done < size; {
		n := int64(len(buf))
		if size-done < n {
			n = size - done
		}
		fillAt(buf[:n], seed, off+done)
		h.Write(buf[:n])
		done += n
	}
	return hex.EncodeToString(h.Sum(nil))
}

// ---- the client ---------------------------------------------------------------------------------------------------------

type client struct {
	host, bucket, ak, sk, region string
	hc                           *http.Client
}

func newHTTPClient() *http.Client {
	return &http.Client{Transport: &http.Transport{
		MaxIdleConns: 256, MaxIdleConnsPerHost: 64, DisableCompression: true, IdleConnTimeout: 30 * time.Second,
		DialContext: (&net.Dialer{Timeout: 10 * time.Second}).DialContext, ReadBufferSize: 256 << 10, WriteBufferSize: 256 << 10,
	}}
}

func hm(key []byte, msg string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(msg))
	return h.Sum(nil)
}

// s3escape percent-encodes everything but A-Za-z0-9-_.~ (and '/' when keepSlash).
func s3escape(s string, keepSlash bool) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.' || c == '~' || keepSlash && c == '/' {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

type kv struct{ k, v string }

// do builds, signs and sends a request. key=="" addresses the bucket. payload is the x-amz-content-sha256 value.
func (c *client) do(method, key string, query []kv, hdr map[string]string, body io.Reader, size int64) (*http.Response, error) {
	path := "/" + c.bucket
	if key != "" {
		path += "/" + s3escape(key, true)
	}
	sort.Slice(query, func(i, j int) bool {
		if query[i].k != query[j].k {
			return query[i].k < query[j].k
		}
		return query[i].v < query[j].v
	})
	var qs []string
	for _, q := range query {
		qs = append(qs, s3escape(q.k, false)+"="+s3escape(q.v, false))
	}
	cq := strings.Join(qs, "&")
	target := "http://" + c.host + path
	if cq != "" {
		target += "?" + cq
	}
	req, err := http.NewRequest(method, target, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.ContentLength = size
		if size == 0 {
			req.Body = http.NoBody
		}
	}
	now := time.Now().UTC()
	amz, date := now.Format("20060102T150405Z"), now.Format("20060102")
	req.Header.Set("x-amz-date", amz)
	req.Header.Set("x-amz-content-sha256", "UNSIGNED-PAYLOAD")
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	names := []string{"host"}
	vals := map[string]string{"host": c.host}
	for k, v := range req.Header {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-amz-") || lk == "content-type" || lk == "content-md5" {
			names = append(names, lk)
			vals[lk] = strings.Join(v, ",")
		}
	}
	sort.Strings(names)
	var canonHdr strings.Builder
	for _, n := range names {
		canonHdr.WriteString(n + ":" + strings.TrimSpace(vals[n]) + "\n")
	}
	creq := strings.Join([]string{method, path, cq, canonHdr.String(), strings.Join(names, ";"), "UNSIGNED-PAYLOAD"}, "\n")
	scope := date + "/" + c.region + "/s3/aws4_request"
	sum := sha256.Sum256([]byte(creq))
	sts := "AWS4-HMAC-SHA256\n" + amz + "\n" + scope + "\n" + hex.EncodeToString(sum[:])
	k := hm([]byte("AWS4"+c.sk), date)
	k = hm(k, c.region)
	k = hm(k, "s3")
	k = hm(k, "aws4_request")
	sig := hex.EncodeToString(hm(k, sts))
	req.Header.Set("Authorization", "AWS4-HMAC-SHA256 Credential="+c.ak+"/"+scope+", SignedHeaders="+strings.Join(names, ";")+", Signature="+sig)
	return c.hc.Do(req)
}

type s3err struct {
	Status int
	Code   string
	Body   string
}

func (e *s3err) Error() string { return fmt.Sprintf("HTTP %d %s %s", e.Status, e.Code, e.Body) }

func readErr(resp *http.Response) error {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	resp.Body.Close()
	code := ""
	if i := strings.Index(string(b), "<Code>"); i >= 0 {
		rest := string(b)[i+6:]
		if j := strings.Index(rest, "</Code>"); j >= 0 {
			code = rest[:j]
		}
	}
	return &s3err{Status: resp.StatusCode, Code: code, Body: strings.TrimSpace(string(b))}
}

func (c *client) ok(resp *http.Response, err error) (*http.Response, error) {
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, readErr(resp)
	}
	return resp, nil
}

func (c *client) put(key string, body io.Reader, size int64) (etag string, err error) {
	resp, err := c.ok(c.do("PUT", key, nil, nil, body, size))
	if err != nil {
		return "", err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return strings.Trim(resp.Header.Get("ETag"), `"`), nil
}

func (c *client) putBytes(key string, b []byte) (string, error) {
	return c.put(key, bytes.NewReader(b), int64(len(b)))
}

// get returns the status; the body is handed to sink.
func (c *client) get(key string, rng string, sink io.Writer) (int, error) {
	hdr := map[string]string{}
	if rng != "" {
		hdr["Range"] = rng
	}
	resp, err := c.do("GET", key, nil, hdr, nil, 0)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return resp.StatusCode, readErr(resp)
	}
	_, err = io.Copy(sink, resp.Body)
	return resp.StatusCode, err
}

func (c *client) head(key string) (int, int64, error) {
	resp, err := c.do("HEAD", key, nil, nil, nil, 0)
	if err != nil {
		return 0, 0, err
	}
	resp.Body.Close()
	return resp.StatusCode, resp.ContentLength, nil
}

func (c *client) del(key string) error {
	resp, err := c.ok(c.do("DELETE", key, nil, nil, nil, 0))
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// ---- multipart ----------------------------------------------------------------------------------------------------------

func (c *client) createMPU(key string) (string, error) {
	resp, err := c.ok(c.do("POST", key, []kv{{"uploads", ""}}, nil, nil, 0))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var r struct{ UploadId string }
	if err := xml.NewDecoder(resp.Body).Decode(&r); err != nil {
		return "", err
	}
	return r.UploadId, nil
}

func (c *client) uploadPart(key, uid string, n int, body io.Reader, size int64) (string, error) {
	resp, err := c.ok(c.do("PUT", key, []kv{{"partNumber", strconv.Itoa(n)}, {"uploadId", uid}}, nil, body, size))
	if err != nil {
		return "", err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return strings.Trim(resp.Header.Get("ETag"), `"`), nil
}

type part struct {
	N    int
	ETag string
}

func (c *client) completeMPU(key, uid string, parts []part) (string, error) {
	var b strings.Builder
	b.WriteString("<CompleteMultipartUpload>")
	for _, p := range parts {
		fmt.Fprintf(&b, "<Part><PartNumber>%d</PartNumber><ETag>\"%s\"</ETag></Part>", p.N, p.ETag)
	}
	b.WriteString("</CompleteMultipartUpload>")
	resp, err := c.ok(c.do("POST", key, []kv{{"uploadId", uid}}, map[string]string{"Content-Type": "application/xml"}, strings.NewReader(b.String()), int64(b.Len())))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	// a slow Complete may answer 200 early and put an <Error> in the body after keep-alive whitespace
	if strings.Contains(string(raw), "<Error>") {
		return "", &s3err{Status: 200, Code: between(string(raw), "<Code>", "</Code>"), Body: string(raw)}
	}
	et := strings.ReplaceAll(between(string(raw), "<ETag>", "</ETag>"), "&quot;", `"`)
	return strings.Trim(et, `"`), nil
}

func between(s, a, b string) string {
	i := strings.Index(s, a)
	if i < 0 {
		return ""
	}
	s = s[i+len(a):]
	j := strings.Index(s, b)
	if j < 0 {
		return ""
	}
	return s[:j]
}

func (c *client) listParts(key, uid string) ([]part, error) {
	resp, err := c.ok(c.do("GET", key, []kv{{"uploadId", uid}}, nil, nil, 0))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var r struct {
		Parts []struct {
			PartNumber int
			ETag       string
			Size       int64
		} `xml:"Part"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	var out []part
	for _, p := range r.Parts {
		out = append(out, part{p.PartNumber, strings.Trim(p.ETag, `"`)})
	}
	return out, nil
}

func (c *client) openUploads() ([]string, error) {
	resp, err := c.ok(c.do("GET", "", []kv{{"uploads", ""}, {"encoding-type", "url"}}, nil, nil, 0))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var r struct {
		Uploads []struct{ Key, UploadId string } `xml:"Upload"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	var out []string
	for _, u := range r.Uploads {
		out = append(out, u.Key+" "+u.UploadId)
	}
	return out, nil
}

// ---- listing ------------------------------------------------------------------------------------------------------------

type listPage struct {
	Keys, Prefixes []string
	Truncated      bool
	Token          string
}

func (c *client) listV2(prefix, delim string, maxKeys int, token string) (*listPage, error) {
	q := []kv{{"list-type", "2"}, {"encoding-type", "url"}, {"max-keys", strconv.Itoa(maxKeys)}}
	if prefix != "" {
		q = append(q, kv{"prefix", prefix})
	}
	if delim != "" {
		q = append(q, kv{"delimiter", delim})
	}
	if token != "" {
		q = append(q, kv{"continuation-token", token})
	}
	resp, err := c.ok(c.do("GET", "", q, nil, nil, 0))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var r struct {
		IsTruncated           bool
		NextContinuationToken string
		Contents              []struct{ Key string }
		CommonPrefixes        []struct{ Prefix string }
	}
	if err := xml.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	p := &listPage{Truncated: r.IsTruncated, Token: r.NextContinuationToken}
	for _, o := range r.Contents {
		p.Keys = append(p.Keys, urlDecode(o.Key))
	}
	for _, o := range r.CommonPrefixes {
		p.Prefixes = append(p.Prefixes, urlDecode(o.Prefix))
	}
	return p, nil
}

// urlDecode decodes an S3 encoding-type=url value ('+' is a space).
func urlDecode(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		switch {
		case s[i] == '+':
			b.WriteByte(' ')
		case s[i] == '%' && i+2 < len(s):
			v, err := strconv.ParseUint(s[i+1:i+3], 16, 8)
			if err != nil {
				b.WriteByte(s[i])
				continue
			}
			b.WriteByte(byte(v))
			i += 2
		default:
			b.WriteByte(s[i])
		}
	}
	return b.String()
}
