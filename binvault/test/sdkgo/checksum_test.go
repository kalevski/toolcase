package sdkgo

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"io"
	"math/big"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// tlsProxy terminates TLS on a loopback port and copies the decrypted bytes to the plain-HTTP node. The Go SDK
// (like every AWS SDK) only uses the trailing-checksum framing over https, so this is how the suite sees it.
type tlsProxy struct {
	URL  string
	Pool *x509.CertPool
	ln   net.Listener
	wg   sync.WaitGroup
}

func newTLSProxy(t testing.TB, target string) *tlsProxy {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	must(t, err, "generate key")
	tpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "127.0.0.1"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1")},
		DNSNames: []string{"localhost"}, BasicConstraintsValid: true, IsCA: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &key.PublicKey, key)
	must(t, err, "create certificate")
	cert, err := x509.ParseCertificate(der)
	must(t, err, "parse certificate")
	pool := x509.NewCertPool()
	pool.AddCert(cert)
	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{
		Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}, NextProtos: []string{"http/1.1"}, MinVersion: tls.VersionTLS12,
	})
	must(t, err, "listen")
	p := &tlsProxy{URL: "https://" + ln.Addr().String(), Pool: pool, ln: ln}
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			p.wg.Add(1)
			go func() {
				defer p.wg.Done()
				defer c.Close()
				u, err := net.Dial("tcp", target)
				if err != nil {
					return
				}
				defer u.Close()
				done := make(chan struct{}, 2)
				go func() { _, _ = io.Copy(u, c); done <- struct{}{} }()
				go func() { _, _ = io.Copy(c, u); done <- struct{}{} }()
				<-done
			}()
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })
	return p
}

func nodeHostPort(e *environment) string { return "127.0.0.1:" + e.port() }

func TestChecksumsPlainHTTP(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "ckhttp", nil)
	rec := &recorder{}
	c := e.newClient(t, b, withRecorder(rec))

	t.Run("default_put_sends_a_crc32_header_and_the_server_keeps_it", func(t *testing.T) {
		data := randBytes(100 * KiB)
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("def"), Body: bytes.NewReader(data)})
		must(t, err, "PutObject")
		w := rec.matching("PUT", "/def")
		if len(w) == 0 || w[len(w)-1].hdr("X-Amz-Checksum-Crc32") != checksumB64(types.ChecksumAlgorithmCrc32, data) {
			t.Fatalf("the SDK did not send the expected x-amz-checksum-crc32 header: %v", w[len(w)-1].Header)
		}
		h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("def"), ChecksumMode: types.ChecksumModeEnabled})
		must(t, err, "HeadObject")
		if aws.ToString(h.ChecksumCRC32) != checksumB64(types.ChecksumAlgorithmCrc32, data) {
			t.Fatalf("stored CRC32 %q", aws.ToString(h.ChecksumCRC32))
		}
	})

	for _, alg := range allChecksumAlgs {
		alg := alg
		t.Run("put_with_"+string(alg), func(t *testing.T) {
			data := randBytes(33 * KiB)
			key := "alg/" + string(alg)
			out, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data), ChecksumAlgorithm: alg})
			must(t, err, "PutObject")
			want := checksumB64(alg, data)
			got := map[types.ChecksumAlgorithm]*string{types.ChecksumAlgorithmCrc32: out.ChecksumCRC32, types.ChecksumAlgorithmCrc32c: out.ChecksumCRC32C,
				types.ChecksumAlgorithmSha1: out.ChecksumSHA1, types.ChecksumAlgorithmSha256: out.ChecksumSHA256, types.ChecksumAlgorithmCrc64nvme: out.ChecksumCRC64NVME}[alg]
			if aws.ToString(got) != want {
				t.Fatalf("PutObject returned %s %q, want %q", alg, aws.ToString(got), want)
			}
			g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, ChecksumMode: types.ChecksumModeEnabled})
			must(t, err, "GetObject")
			sameBytes(t, "body", readAll(t, g.Body), data)
		})
	}

	t.Run("a_wrong_checksum_is_baddigest", func(t *testing.T) {
		data := randBytes(1000)
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("bad"), Body: bytes.NewReader(data), ChecksumSHA256: aws.String(checksumB64(types.ChecksumAlgorithmSha256, []byte("other")))})
		requireAPIError(t, err, "BadDigest", 400)
		_, err = c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("bad")})
		if err == nil {
			t.Fatalf("a rejected PutObject stored something")
		}
	})

	t.Run("when_required_sends_no_checksum", func(t *testing.T) {
		rec2 := &recorder{}
		c2 := e.newClient(t, b, withRecorder(rec2), withReqChecksum(aws.RequestChecksumCalculationWhenRequired), withRespChecksum(aws.ResponseChecksumValidationWhenRequired))
		_, err := c2.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("req"), Body: strings.NewReader("no checksum")})
		must(t, err, "PutObject")
		w := rec2.matching("PUT", "/req")
		for h := range w[len(w)-1].Header {
			if strings.HasPrefix(strings.ToLower(h), "x-amz-checksum") {
				t.Fatalf("unexpected checksum header %s", h)
			}
		}
	})

	t.Run("unsupported_algorithms_are_refused_not_ignored", func(t *testing.T) {
		// SHA512 is the one newer S3 algorithm this SDK can compute (MD5/XXHASH* are modelled but not implemented client-side)
		for _, alg := range []types.ChecksumAlgorithm{types.ChecksumAlgorithmSha512} {
			alg := alg
			t.Run(string(alg), func(t *testing.T) {
				key := "unsup/" + string(alg)
				_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: strings.NewReader("data"), ChecksumAlgorithm: alg})
				if err == nil {
					// the SDK computed a checksum the server does not know: it must not claim to have verified it
					h, herr := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key, ChecksumMode: types.ChecksumModeEnabled})
					must(t, herr, "HeadObject")
					t.Fatalf("PutObject with ChecksumAlgorithm=%s was accepted and the checksum silently dropped (head: crc32=%q sha256=%q); the server should answer 4xx", alg, aws.ToString(h.ChecksumCRC32), aws.ToString(h.ChecksumSHA256))
				}
				if _, status := apiError(err); status < 400 || status >= 500 {
					t.Fatalf("want a 4xx for an unsupported checksum algorithm, got %v", err)
				}
			})
		}
	})
}

func TestChecksumsOverTLS(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	proxy := newTLSProxy(t, nodeHostPort(e))
	b := e.newBucket(t, "cktls", nil)
	rec := &recorder{}
	c := e.newClient(t, b, withRecorder(rec), withTLS(proxy.URL, proxy.Pool))

	t.Run("default_put_uses_the_unsigned_trailer_framing", func(t *testing.T) {
		for _, size := range []int{0, 1, 5000, 64 * KiB, 64*KiB + 1, 3 * MiB} {
			key := "tr/" + strings.Repeat("x", 1+size%7)
			data := randBytes(size)
			rec.reset()
			out, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data)})
			must(t, err, "PutObject")
			w := rec.matching("PUT", key)
			if len(w) != 1 {
				t.Fatalf("expected one PUT, saw %d", len(w))
			}
			if size > 0 { // an empty body is sent as UNSIGNED-PAYLOAD with a plain checksum header
				if sha := w[0].hdr("X-Amz-Content-Sha256"); sha != "STREAMING-UNSIGNED-PAYLOAD-TRAILER" {
					t.Fatalf("size %d: x-amz-content-sha256 = %q; this SDK is expected to use the unsigned trailer over https", size, sha)
				}
				if w[0].hdr("X-Amz-Trailer") != "x-amz-checksum-crc32" {
					t.Errorf("x-amz-trailer = %q", w[0].hdr("X-Amz-Trailer"))
				}
			}
			if aws.ToString(out.ETag) != etagOf(data) {
				t.Fatalf("size %d: ETag %q", size, aws.ToString(out.ETag))
			}
			g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, ChecksumMode: types.ChecksumModeEnabled})
			must(t, err, "GetObject")
			sameBytes(t, "body", readAll(t, g.Body), data)
			if aws.ToString(g.ChecksumCRC32) != checksumB64(types.ChecksumAlgorithmCrc32, data) {
				t.Errorf("size %d: stored CRC32 %q", size, aws.ToString(g.ChecksumCRC32))
			}
			if strings.Contains(aws.ToString(g.ContentEncoding), "aws-chunked") {
				t.Errorf("aws-chunked leaked into Content-Encoding: %q", aws.ToString(g.ContentEncoding))
			}
		}
	})

	for _, alg := range allChecksumAlgs {
		alg := alg
		t.Run("trailer_"+string(alg), func(t *testing.T) {
			data := randBytes(300 * KiB)
			key := "trailer/" + string(alg)
			_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data), ChecksumAlgorithm: alg})
			must(t, err, "PutObject")
			h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key, ChecksumMode: types.ChecksumModeEnabled})
			must(t, err, "HeadObject")
			got := map[types.ChecksumAlgorithm]*string{types.ChecksumAlgorithmCrc32: h.ChecksumCRC32, types.ChecksumAlgorithmCrc32c: h.ChecksumCRC32C,
				types.ChecksumAlgorithmSha1: h.ChecksumSHA1, types.ChecksumAlgorithmSha256: h.ChecksumSHA256, types.ChecksumAlgorithmCrc64nvme: h.ChecksumCRC64NVME}[alg]
			if aws.ToString(got) != checksumB64(alg, data) {
				t.Fatalf("stored %s %q, want %q", alg, aws.ToString(got), checksumB64(alg, data))
			}
		})
	}

	t.Run("multipart_with_trailers", func(t *testing.T) {
		data := randBytes(11*MiB + 7)
		out, err := manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 5 * MiB; u.Concurrency = 3 }).Upload(ctx,
			&s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("mp"), Body: bytes.NewReader(data)})
		must(t, err, "Upload")
		if aws.ToString(out.ETag) != multipartETag(splitParts(data, 5*MiB)...) {
			t.Fatalf("ETag %q", aws.ToString(out.ETag))
		}
		buf := manager.NewWriteAtBuffer(nil)
		_, err = manager.NewDownloader(c, func(d *manager.Downloader) { d.PartSize = 5 * MiB }).Download(ctx, buf, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("mp")})
		must(t, err, "Download")
		sameBytes(t, "object", buf.Bytes(), data)
	})

	t.Run("http2_is_not_offered_and_keepalive_works", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("ka"), Body: strings.NewReader("keep alive")})
			must(t, err, "PutObject")
		}
		if reused := func() int {
			n := 0
			for _, w := range rec.all() {
				if w.Reused {
					n++
				}
			}
			return n
		}(); reused == 0 {
			t.Errorf("no request reused a connection")
		}
	})
}
