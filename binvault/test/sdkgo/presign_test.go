package sdkgo

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

func doReq(t testing.TB, hc *http.Client, method, u string, hdr http.Header, body []byte) (int, []byte, http.Header) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		rd = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, u, rd)
	must(t, err, "new request")
	for k, v := range hdr {
		req.Header[k] = v
	}
	resp, err := hc.Do(req)
	must(t, err, method+" "+u)
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, raw, resp.Header
}

func presignedFn(p *v4.PresignedHTTPRequest, err error) (string, string, http.Header, error) {
	if err != nil {
		return "", "", nil, err
	}
	return p.URL, p.Method, p.SignedHeader, nil
}

func TestPresign(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "presign", nil)
	c := e.newClient(t, b)
	ps := s3.NewPresignClient(c)
	hc := e.plainHTTP(nil)
	data := randBytes(50 * KiB)
	_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin"), Body: bytes.NewReader(data), ContentType: aws.String("application/x-presign")})
	must(t, err, "PutObject")

	t.Run("get", func(t *testing.T) {
		u, m, h, err := presignedFn(ps.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}, s3.WithPresignExpires(5*time.Minute)))
		must(t, err, "PresignGetObject")
		if m != "GET" || !strings.Contains(u, "X-Amz-Signature=") || !strings.Contains(u, "X-Amz-Algorithm=AWS4-HMAC-SHA256") {
			t.Fatalf("unexpected presigned request %s %s", m, u)
		}
		st, body, hd := doReq(t, hc, m, u, h, nil)
		if st != 200 || !bytes.Equal(body, data) || hd.Get("Content-Type") != "application/x-presign" {
			t.Fatalf("GET: HTTP %d, %d bytes, Content-Type %q", st, len(body), hd.Get("Content-Type"))
		}
	})
	t.Run("get_with_response_overrides", func(t *testing.T) {
		u, _, _, err := presignedFn(ps.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin"),
			ResponseContentType: aws.String("text/plain"), ResponseContentDisposition: aws.String(`attachment; filename="x y.bin"`), ResponseCacheControl: aws.String("no-store")}))
		must(t, err, "PresignGetObject")
		st, _, hd := doReq(t, hc, "GET", u, nil, nil)
		if st != 200 || hd.Get("Content-Type") != "text/plain" || hd.Get("Content-Disposition") != `attachment; filename="x y.bin"` || hd.Get("Cache-Control") != "no-store" {
			t.Fatalf("HTTP %d headers %v", st, hd)
		}
	})
	t.Run("get_with_range_header_signed", func(t *testing.T) {
		u, _, h, err := presignedFn(ps.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin"), Range: aws.String("bytes=10-19")}))
		must(t, err, "PresignGetObject")
		st, body, _ := doReq(t, hc, "GET", u, h, nil)
		if st != 206 || !bytes.Equal(body, data[10:20]) {
			t.Fatalf("HTTP %d, %d bytes", st, len(body))
		}
	})
	t.Run("head", func(t *testing.T) {
		u, m, h, err := presignedFn(ps.PresignHeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}))
		must(t, err, "PresignHeadObject")
		st, _, hd := doReq(t, hc, m, u, h, nil)
		if st != 200 || hd.Get("Content-Length") != "51200" {
			t.Fatalf("HEAD: HTTP %d length %q", st, hd.Get("Content-Length"))
		}
	})
	t.Run("put_with_signed_content_type_and_metadata", func(t *testing.T) {
		u, m, h, err := presignedFn(ps.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("put/target"), ContentType: aws.String("text/x-signed"), Metadata: map[string]string{"who": "presign"}}))
		must(t, err, "PresignPutObject")
		st, body, _ := doReq(t, hc, m, u, h, []byte("uploaded through a presigned url"))
		if st != 200 {
			t.Fatalf("PUT: HTTP %d: %s\nurl: %s\nsigned headers: %v", st, body, u, h)
		}
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("put/target")})
		must(t, err, "GetObject")
		sameBytes(t, "body", readAll(t, g.Body), []byte("uploaded through a presigned url"))
		if aws.ToString(g.ContentType) != "text/x-signed" || g.Metadata["who"] != "presign" {
			t.Fatalf("headers: %q %v", aws.ToString(g.ContentType), g.Metadata)
		}
		// without the signed headers the same URL is refused
		st, _, _ = doReq(t, hc, m, u, nil, []byte("x"))
		if st != 403 {
			t.Errorf("a presigned PUT without its signed headers should be 403, got %d", st)
		}
	})
	t.Run("put_with_default_checksum_settings", func(t *testing.T) {
		// recent SDKs add a checksum algorithm parameter to presigned PUT URLs
		u, m, h, err := presignedFn(ps.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("put/default")}))
		must(t, err, "PresignPutObject")
		t.Logf("presigned PUT: %s", u)
		st, body, _ := doReq(t, hc, m, u, h, []byte("default settings"))
		if st != 200 {
			t.Fatalf("PUT with the SDK's default presign settings: HTTP %d: %s", st, body)
		}
	})
	t.Run("delete", func(t *testing.T) {
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("del/me"), Body: strings.NewReader("x")})
		must(t, err, "PutObject")
		u, m, h, err := presignedFn(ps.PresignDeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: aws.String("del/me")}))
		must(t, err, "PresignDeleteObject")
		st, _, _ := doReq(t, hc, m, u, h, nil)
		if st != 204 {
			t.Fatalf("DELETE: HTTP %d", st)
		}
		_, err = c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("del/me")})
		if err == nil {
			t.Fatalf("object still there")
		}
	})
	t.Run("multipart_with_presigned_parts", func(t *testing.T) {
		create, err := c.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{Bucket: &b.Name, Key: aws.String("mp/presigned")})
		must(t, err, "CreateMultipartUpload")
		parts := [][]byte{randBytes(5 * MiB), randBytes(100)}
		var done []types.CompletedPart
		for i, p := range parts {
			n := int32(i + 1)
			u, m, h, err := presignedFn(ps.PresignUploadPart(ctx, &s3.UploadPartInput{Bucket: &b.Name, Key: aws.String("mp/presigned"), UploadId: create.UploadId, PartNumber: &n}))
			must(t, err, "PresignUploadPart")
			st, body, hd := doReq(t, hc, m, u, h, p)
			if st != 200 {
				t.Fatalf("part %d: HTTP %d: %s", n, st, body)
			}
			et := hd.Get("ETag")
			done = append(done, types.CompletedPart{ETag: aws.String(et), PartNumber: &n})
		}
		_, err = c.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: &b.Name, Key: aws.String("mp/presigned"), UploadId: create.UploadId, MultipartUpload: &types.CompletedMultipartUpload{Parts: done}})
		must(t, err, "CompleteMultipartUpload")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("mp/presigned")})
		must(t, err, "GetObject")
		sameBytes(t, "object", readAll(t, g.Body), bytes.Join(parts, nil))
	})
	t.Run("expiry", func(t *testing.T) {
		u, _, _, err := presignedFn(ps.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}, s3.WithPresignExpires(1*time.Second)))
		must(t, err, "PresignGetObject")
		if st, _, _ := doReq(t, hc, "GET", u, nil, nil); st != 200 {
			t.Fatalf("fresh URL: HTTP %d", st)
		}
		time.Sleep(2500 * time.Millisecond)
		st, body, _ := doReq(t, hc, "GET", u, nil, nil)
		if st != 403 || !strings.Contains(string(body), "AccessDenied") {
			t.Fatalf("expired URL: HTTP %d %s", st, body)
		}
	})
	t.Run("seven_days", func(t *testing.T) {
		u, _, _, err := presignedFn(ps.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}, s3.WithPresignExpires(7*24*time.Hour)))
		must(t, err, "PresignGetObject")
		if st, _, _ := doReq(t, hc, "GET", u, nil, nil); st != 200 {
			t.Fatalf("HTTP %d", st)
		}
	})
	t.Run("tampering", func(t *testing.T) {
		u, _, _, err := presignedFn(ps.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}))
		must(t, err, "PresignGetObject")
		pu, _ := url.Parse(u)
		for name, mutate := range map[string]func(q url.Values, p *url.URL){
			"signature": func(q url.Values, _ *url.URL) {
				s := q.Get("X-Amz-Signature")
				first := "0"
				if s[:1] == first { // a signature that starts with 0 must still change
					first = "1"
				}
				q.Set("X-Amz-Signature", first+s[1:])
			},
			"key":     func(_ url.Values, p *url.URL) { p.Path = strings.Replace(p.Path, "obj one", "obj two", 1) },
			"expires": func(q url.Values, _ *url.URL) { q.Set("X-Amz-Expires", "604800") },
			"extra":   func(q url.Values, _ *url.URL) { q.Set("response-content-type", "text/html") },
		} {
			cp := *pu
			q := cp.Query()
			mutate(q, &cp)
			cp.RawQuery = q.Encode()
			cp.RawPath = ""
			st, _, _ := doReq(t, hc, "GET", cp.String(), nil, nil)
			if st != 403 {
				t.Errorf("tampered %s: HTTP %d, want 403", name, st)
			}
		}
	})
	t.Run("virtual_hosted_style", func(t *testing.T) {
		cv := e.newClient(t, b, withVirtual())
		psv := s3.NewPresignClient(cv)
		u, _, _, err := presignedFn(psv.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}))
		must(t, err, "PresignGetObject")
		if !strings.HasPrefix(u, "http://"+b.Name+"."+e.Domain) {
			t.Fatalf("not a virtual-hosted URL: %s", u)
		}
		st, body, _ := doReq(t, hc, "GET", u, nil, nil)
		if st != 200 || !bytes.Equal(body, data) {
			t.Fatalf("HTTP %d, %d bytes", st, len(body))
		}
	})
	t.Run("revoked_token_kills_the_url", func(t *testing.T) {
		tok := e.newToken(t, b.Name, fullGrant, nil)
		cc := e.newClient(t, tok)
		u, _, _, err := presignedFn(s3.NewPresignClient(cc).PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("dir/obj one.bin")}))
		must(t, err, "PresignGetObject")
		if st, _, _ := doReq(t, hc, "GET", u, nil, nil); st != 200 {
			t.Fatalf("HTTP %d", st)
		}
		status, raw, err := e.admin("DELETE", "/buckets/"+b.Name+"/tokens/"+tok.AccessKey, nil)
		if err != nil || status >= 300 {
			t.Fatalf("revoke: %v %d %s", err, status, raw)
		}
		st, body, _ := doReq(t, hc, "GET", u, nil, nil)
		if st != 403 {
			t.Fatalf("a URL of a revoked token must stop working: HTTP %d %s", st, body)
		}
	})
}
