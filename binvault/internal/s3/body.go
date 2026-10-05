package s3

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"hash"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// upload is a request body prepared for the engine: decoded, paced, with the
// verification the headers asked for (spec §5.8).
type upload struct {
	Body io.Reader
	// Size is the declared plaintext length, -1 when unknown.
	Size int64
	// Algo is the additional checksum to compute ("" none).
	Algo string
	// Verify checks Content-MD5, the signed payload hash and the checksum.
	Verify func(*engine.Received) error
	stream *sigv4.StreamReader
}

// prepareUpload wraps the request body for a PutObject-like call: aws-chunked
// decoding with chunk signatures and trailers, the idle timeout, bandwidth
// pacing, and the expected digests.
func (s *Server) prepareUpload(rc *reqCtx) (*upload, error) {
	r := rc.r
	u := &upload{Size: -1}

	var raw io.Reader = httpx.NewIdleReader(rc.w, r.Body, s.Cfg.BodyIdleTimeout, rc.info)
	if s.Limits != nil && rc.p.Kind != "pipeline" {
		raw = s.Limits.WrapReader(rc.ctx, rc.p, rc.b, raw)
	}

	chunked := rc.sig != nil && rc.sig.Stream != sigv4.StreamNone
	if chunked {
		v := r.Header.Get("x-amz-decoded-content-length")
		if v == "" {
			return nil, apierr.New("MissingContentLength", "You must provide the Content-Length HTTP header.")
		}
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 0 {
			return nil, apierr.New("InvalidArgument", "x-amz-decoded-content-length is not a valid length.")
		}
		u.Size = n
		u.stream = sigv4.NewStreamReader(raw, rc.sig, 0)
		u.Body = u.stream
	} else {
		switch {
		case r.ContentLength >= 0 && (r.ContentLength > 0 || r.Header.Get("Content-Length") != "" || r.ProtoMajor != 1):
			u.Size = r.ContentLength
		case len(r.TransferEncoding) > 0 && r.ContentLength < 0:
			u.Size = -1 // Transfer-Encoding: chunked, accepted liberally
		case r.ContentLength == 0 && r.Header.Get("Content-Length") == "" && len(r.TransferEncoding) == 0 && r.ProtoMajor == 1:
			return nil, apierr.New("MissingContentLength", "You must provide the Content-Length HTTP header.")
		default:
			u.Size = r.ContentLength
		}
		u.Body = raw
	}

	// expected digests
	md5sum, err := ParseContentMD5(r.Header.Get("Content-MD5"))
	if err != nil {
		return nil, err
	}
	algo, value, trailerExpected, err := requestChecksum(r.Header)
	if err != nil {
		return nil, err
	}
	u.Algo = string(algo)
	payloadHash := ""
	if rc.sig != nil {
		payloadHash = rc.sig.PayloadHash
	}
	u.Verify = func(rec *engine.Received) error {
		if md5sum != nil && !bytes.Equal(md5sum, rec.MD5) {
			return apierr.New("BadDigest", "The Content-MD5 you specified did not match what we received.")
		}
		if len(payloadHash) == 64 && !strings.EqualFold(payloadHash, hex.EncodeToString(rec.SHA256)) {
			return apierr.New("XAmzContentSHA256Mismatch", "The provided 'x-amz-content-sha256' header does not match what was computed.")
		}
		if algo != "" {
			want := value
			if want == "" && u.stream != nil {
				var err error
				if want, err = trailerValue(algo, u.stream.Trailer()); err != nil {
					return err
				}
			}
			if want == "" && trailerExpected {
				return errTrailerMissing()
			}
			if want != "" && want != checksum.Encode(rec.Checksum) {
				return apierr.New("BadDigest", "The "+u.Algo+" you specified did not match the calculated checksum.")
			}
		}
		return nil
	}
	return u, nil
}

// requestChecksum reads which checksum a request wants verified: an
// x-amz-checksum-<algo> header (value set), a trailer announced by x-amz-trailer
// (trailerExpected: the value comes after the body and must arrive), or only
// the algorithm declared in x-amz-sdk-checksum-algorithm (computed and stored,
// nothing to compare). A checksum binvault does not implement is refused
// (InvalidRequest), never skipped (spec §5.8).
func requestChecksum(h http.Header) (algo checksum.Algo, value string, trailerExpected bool, err error) {
	algo, value, found, err := checksum.FromHeader(h)
	if err != nil || found {
		return algo, value, false, err
	}
	if algo, err = trailerChecksum(h); err != nil || algo != "" {
		return algo, "", err == nil, err
	}
	if v := strings.TrimSpace(h.Get("x-amz-sdk-checksum-algorithm")); v != "" {
		a, ok := checksum.ParseAlgo(v)
		if !ok {
			return "", "", false, checksum.Unsupported(v)
		}
		return a, "", false, nil
	}
	return "", "", false, nil
}

// errTrailerMissing is the answer when x-amz-trailer announced a checksum that
// never arrived: storing the body unverified would hide a truncated or tampered
// stream (spec §5.8).
func errTrailerMissing() *apierr.Error {
	return apierr.New("MalformedTrailerError", "The request contained trailing data that was not well-formed or did not conform to our published schema.")
}

// trailerValue returns the canonical base64 of the checksum a decoded aws-chunked
// body carried as a trailer, "" when there is none (or no trailer section).
func trailerValue(a checksum.Algo, trailer http.Header) (string, error) {
	// trailer names are lower-cased by the decoder: index the map directly
	vals := trailer[a.HeaderName()]
	if len(vals) == 0 || vals[0] == "" {
		return "", nil
	}
	raw, err := checksum.Decode(strings.TrimSpace(vals[0]))
	if err != nil || len(raw) != a.Size() {
		return "", apierr.New("InvalidRequest", "Value for "+a.HeaderName()+" trailer is invalid.")
	}
	return checksum.Encode(raw), nil
}

// trailerChecksum reads x-amz-trailer: x-amz-checksum-<algo>. A trailer of an
// algorithm binvault does not implement is refused up front (InvalidRequest),
// not skipped.
func trailerChecksum(h http.Header) (checksum.Algo, error) {
	var found checksum.Algo
	for _, v := range h.Values("x-amz-trailer") {
		for _, name := range strings.Split(v, ",") {
			name = strings.TrimSpace(name)
			if a, ok := checksum.FromHeaderName(name); ok {
				if found == "" {
					found = a
				}
			} else if checksum.UnsupportedHeaderName(name) {
				return "", checksum.Unsupported(name)
			}
		}
	}
	return found, nil
}

// verifyBodyChecksum checks the x-amz-checksum-<algo> a request carried (as a
// header, or as the trailer of an aws-chunked body: trailer is its decoder's)
// against a body that was read whole: DeleteObjects, spec §5.4.4. Without a
// checksum it does nothing; the Content-MD5 is judged by the caller.
func verifyBodyChecksum(h, trailer http.Header, body []byte) error {
	algo, value, trailerExpected, err := requestChecksum(h)
	if err != nil || algo == "" {
		return err
	}
	if value == "" {
		if value, err = trailerValue(algo, trailer); err != nil {
			return err
		}
	}
	if value == "" {
		if trailerExpected {
			return errTrailerMissing()
		}
		return nil // only the algorithm was declared
	}
	hh := algo.New()
	hh.Write(body)
	if checksum.Encode(hh.Sum(nil)) != value {
		return apierr.New("BadDigest", "The "+string(algo)+" you specified did not match the calculated checksum.")
	}
	return nil
}

// readXMLBody returns the request body for XML requests (bounded, decoded from
// aws-chunked when the SDK streamed it).
func (s *Server) xmlBody(rc *reqCtx) io.Reader {
	var raw io.Reader = httpx.NewIdleReader(rc.w, rc.r.Body, s.Cfg.BodyIdleTimeout, rc.info)
	if rc.sig != nil && rc.sig.Stream != sigv4.StreamNone {
		return sigv4.NewStreamReader(raw, rc.sig, 0) // chunk signatures protect the bytes
	}
	if rc.sig != nil && len(rc.sig.PayloadHash) == 64 {
		// a signed payload hash covers the body: without this check an on-path party
		// could alter a signed DeleteObjects / Complete / Tagging document (spec §5.8)
		return &hashChecked{r: raw, h: sha256.New(), want: rc.sig.PayloadHash}
	}
	return raw
}

// hashChecked passes the body through and, at its end, fails with
// XAmzContentSHA256Mismatch unless it hashes to the signed value.
type hashChecked struct {
	r    io.Reader
	h    hash.Hash
	want string
	done bool
}

func (c *hashChecked) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.h.Write(p[:n])
	if err == io.EOF && !c.done {
		c.done = true
		if !strings.EqualFold(hex.EncodeToString(c.h.Sum(nil)), c.want) {
			return n, apierr.New("XAmzContentSHA256Mismatch", "The provided 'x-amz-content-sha256' header does not match what was computed.")
		}
	}
	return n, err
}
