package sigv4

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// DefaultMaxChunk is the largest aws-chunked chunk accepted when
// NewStreamReader is given maxChunk <= 0.
const DefaultMaxChunk = 16 << 20

const (
	// maxLine is the longest chunk-header or trailer line, CRLF included.
	maxLine = 4 << 10
	// maxTrailers bounds the trailer headers of one body.
	maxTrailers = 32
	// minChunkBuf is the first allocation for a chunk's data; the buffer then
	// grows with the bytes that actually arrive, never with the declared size.
	minChunkBuf = 32 << 10
)

// String-to-sign algorithms of the aws-chunked signatures.
const (
	chunkAlgorithm   = "AWS4-HMAC-SHA256-PAYLOAD"
	trailerAlgorithm = "AWS4-HMAC-SHA256-TRAILER"
	trailerSigName   = "x-amz-trailer-signature"
)

const (
	stHeader = iota // the next thing to read is a chunk header
	stData          // serving the current chunk
	stDone          // the body is fully decoded
)

// StreamReader decodes an aws-chunked request body (spec §5.8) and verifies it
// as it goes. The body is
//
//	<hex-size>[;chunk-signature=<sig>]\r\n<data>\r\n   (repeated)
//	0[;chunk-signature=<sig>]\r\n
//	[<name>:<value>\r\n ...]                            (trailer modes)
//	[x-amz-trailer-signature:<sig>\r\n]                 (signed trailer)
//	\r\n
//
// Each chunk signature chains from the request's seed signature; the trailer
// signature covers the canonical trailer and chains from the final chunk.
// In the signed modes a chunk is released to the caller only after its
// signature verified, so at most one chunk (at most maxChunk bytes, grown as
// it arrives) is buffered; unsigned chunks stream straight through.
//
// Errors: a bad or missing chunk or trailer signature is
// SignatureDoesNotMatch; truncated or malformed framing is IncompleteBody; a
// chunk larger than maxChunk, a line over 4 KiB or too many trailers is
// InvalidRequest. Errors of the underlying reader other than end of input
// are returned unchanged (so a body-size or timeout error keeps its type).
// The first error is sticky. Checking the decoded length and hash is the
// caller's job.
type StreamReader struct {
	br       *bufio.Reader
	mode     StreamMode
	maxChunk int64
	key      []byte
	prevSig  string
	amzDate  string
	scope    string

	state    int
	buf      []byte // signed modes: the verified chunk being served
	off      int
	remain   int64 // unsigned mode: bytes left in the current chunk
	needCRLF bool  // unsigned mode: the CRLF after a chunk's data is due
	chunk    int   // chunks seen, for messages
	trailer  http.Header
	err      error
}

type trailerField struct{ name, value string }

// NewStreamReader returns a reader of the decoded payload of an aws-chunked
// body. res is the verified request (Verify), whose Stream selects the mode
// and whose SigningKey, Signature, AmzDate, Date and Region seed the chunk
// signatures. maxChunk bounds one chunk's size (DefaultMaxChunk when <= 0). A
// Result whose Stream is StreamNone yields an InternalError: that body is not
// aws-chunked.
func NewStreamReader(body io.Reader, res *Result, maxChunk int) *StreamReader {
	s := &StreamReader{maxChunk: DefaultMaxChunk}
	if maxChunk > 0 {
		s.maxChunk = int64(maxChunk)
	}
	if body == nil || res == nil {
		s.err = apierr.New("InternalError", "sigv4: NewStreamReader needs a body and a verified Result")
		return s
	}
	s.br = bufio.NewReaderSize(body, maxLine)
	s.mode = res.Stream
	switch s.mode {
	case StreamSigned, StreamSignedTrailer:
		if len(res.SigningKey) == 0 || !isLowerHex64(res.Signature) {
			s.err = apierr.New("InternalError", "sigv4: a signed stream needs the request's signing key and signature")
			return s
		}
		s.key = append([]byte(nil), res.SigningKey...)
		s.prevSig = res.Signature
		s.amzDate = res.amzDate()
		s.scope = res.scope()
	case StreamUnsignedTrailer:
	default:
		s.err = apierr.New("InternalError", "sigv4: the request payload is not aws-chunked")
	}
	return s
}

// Read reads decoded payload bytes. It returns io.EOF only after the final
// chunk, the trailer and its signature have all been read and verified.
func (s *StreamReader) Read(p []byte) (int, error) {
	for {
		if s.err != nil {
			return 0, s.err
		}
		switch s.state {
		case stDone:
			return 0, io.EOF
		case stHeader:
			s.err = s.next()
		case stData:
			if len(p) == 0 {
				return 0, nil
			}
			if s.mode == StreamUnsignedTrailer {
				return s.readUnsigned(p)
			}
			n := copy(p, s.buf[s.off:])
			s.off += n
			if s.off == len(s.buf) {
				s.state = stHeader
			}
			return n, nil
		}
	}
}

// Trailer returns the trailer headers once Read has returned io.EOF, keyed by
// lower-case name (index the map directly: http.Header.Get canonicalises the
// name and would miss). For StreamSignedTrailer it includes
// x-amz-trailer-signature. Validating the names against x-amz-trailer is the
// caller's job. It is nil before the end of the body, after an error, and for
// StreamSigned, which has no trailer.
func (s *StreamReader) Trailer() http.Header {
	if s.state != stDone || s.err != nil {
		return nil
	}
	return s.trailer
}

// readUnsigned passes the current unsigned chunk through.
func (s *StreamReader) readUnsigned(p []byte) (int, error) {
	if int64(len(p)) > s.remain {
		p = p[:s.remain]
	}
	n, err := s.br.Read(p)
	s.remain -= int64(n)
	if s.remain == 0 {
		s.state = stHeader
		return n, nil
	}
	if err != nil {
		s.err = s.readErr(err, "the body ended inside a chunk")
		if n > 0 {
			return n, nil
		}
		return 0, s.err
	}
	return n, nil
}

// next reads a chunk header and, in the signed modes, the chunk and its
// verification; a zero-size chunk leads into the trailer.
func (s *StreamReader) next() error {
	if s.needCRLF {
		if err := s.readCRLF(); err != nil {
			return err
		}
		s.needCRLF = false
	}
	line, _, err := s.readLine()
	if err != nil {
		return err
	}
	s.chunk++
	size, sig, err := s.parseChunkHeader(line)
	if err != nil {
		return err
	}
	if s.mode == StreamUnsignedTrailer {
		if size == 0 {
			return s.readTrailer()
		}
		s.remain, s.needCRLF, s.state = size, true, stData
		return nil
	}
	if err := s.readChunk(size); err != nil {
		return err
	}
	if err := s.verifyChunk(sig); err != nil {
		return err
	}
	if size == 0 {
		return s.readTrailer()
	}
	s.off, s.state = 0, stData
	return nil
}

// parseChunkHeader parses `<hex-size>[;chunk-signature=<sig>]`.
func (s *StreamReader) parseChunkHeader(line []byte) (int64, string, error) {
	sizePart, ext, hasExt := bytes.Cut(line, []byte{';'})
	if len(sizePart) == 0 || len(sizePart) > 16 {
		return 0, "", errStreamFraming(fmt.Sprintf("chunk %d has an invalid size", s.chunk))
	}
	var size uint64
	for _, c := range sizePart {
		d := unhex(c)
		if d < 0 {
			return 0, "", errStreamFraming(fmt.Sprintf("chunk %d has an invalid size", s.chunk))
		}
		size = size<<4 | uint64(d)
	}
	if size > uint64(s.maxChunk) {
		return 0, "", errStreamLimit(fmt.Sprintf("chunk %d declares %d bytes, more than the %d allowed",
			s.chunk, size, s.maxChunk))
	}
	if s.mode == StreamUnsignedTrailer {
		if hasExt {
			return 0, "", errStreamFraming(fmt.Sprintf("chunk %d carries an extension in an unsigned stream", s.chunk))
		}
		return int64(size), "", nil
	}
	if !hasExt {
		return 0, "", errStreamFraming(fmt.Sprintf("chunk %d has no chunk-signature", s.chunk))
	}
	sig, ok := bytes.CutPrefix(ext, []byte("chunk-signature="))
	if !ok {
		return 0, "", errStreamFraming(fmt.Sprintf("chunk %d has an unknown extension", s.chunk))
	}
	return int64(size), string(sig), nil
}

// readChunk reads size bytes of chunk data (and the CRLF after them) into
// s.buf, growing it only as data arrives.
func (s *StreamReader) readChunk(size int64) error {
	n := int(size)
	s.buf = s.buf[:0]
	for len(s.buf) < n {
		if len(s.buf) == cap(s.buf) {
			c := 2 * cap(s.buf)
			if c < minChunkBuf {
				c = minChunkBuf
			}
			if c > n {
				c = n
			}
			nb := make([]byte, len(s.buf), c)
			copy(nb, s.buf)
			s.buf = nb
		}
		end := cap(s.buf)
		if end > n {
			end = n
		}
		k, err := io.ReadFull(s.br, s.buf[len(s.buf):end])
		s.buf = s.buf[:len(s.buf)+k]
		if err != nil {
			return s.readErr(err, "the body ended inside a chunk")
		}
	}
	if n == 0 {
		return nil
	}
	return s.readCRLF()
}

// verifyChunk checks the signature of the chunk in s.buf.
func (s *StreamReader) verifyChunk(provided string) error {
	h := sha256.Sum256(s.buf)
	sts := chunkAlgorithm + "\n" + s.amzDate + "\n" + s.scope + "\n" + s.prevSig + "\n" +
		EmptySHA256 + "\n" + hex.EncodeToString(h[:])
	want := hmacHex(s.key, sts)
	if subtle.ConstantTimeCompare([]byte(want), []byte(provided)) != 1 {
		return errStreamSignature(fmt.Sprintf("chunk %d", s.chunk))
	}
	s.prevSig = want
	return nil
}

// readTrailer reads what follows the final chunk: an empty line for
// StreamSigned, trailer lines and an empty line for the trailer modes. Only
// where AWS SDKs do it (the JS SDK ends an unsigned stream right after "0\r\n"
// or after its last trailer line) may the body end in place of that last
// empty line: in the unsigned trailer mode, and in the signed one after the
// trailer signature.
func (s *StreamReader) readTrailer() error {
	if s.mode == StreamSigned {
		line, _, err := s.readLine()
		if err != nil {
			return err
		}
		if len(line) != 0 {
			return errStreamFraming("unexpected trailer after the final chunk of a stream without trailers")
		}
		return s.finish(false)
	}
	signed := s.mode == StreamSignedTrailer
	var (
		fields []trailerField
		sig    string
		sawSig bool
		eof    bool
	)
	for {
		line, atEOF, err := s.readLine()
		if err != nil {
			if atEOF && (!signed || sawSig) {
				eof = true
				break
			}
			return err
		}
		if len(line) == 0 {
			break
		}
		if sawSig {
			return errStreamFraming(trailerSigName + " must be the last trailer")
		}
		name, value, ok := parseTrailerLine(line)
		if !ok {
			return errStreamFraming("a trailer line is malformed")
		}
		if name == trailerSigName {
			if !signed {
				return errStreamFraming(trailerSigName + " in an unsigned stream")
			}
			sig, sawSig = value, true
			continue
		}
		if len(fields) == maxTrailers {
			return errStreamLimit(fmt.Sprintf("more than %d trailer headers", maxTrailers))
		}
		fields = append(fields, trailerField{name, value})
	}
	if signed {
		if !sawSig {
			return errStreamSignature("the trailer has no " + trailerSigName)
		}
		if err := s.verifyTrailer(fields, sig); err != nil {
			return err
		}
	}
	h := make(http.Header, len(fields)+1)
	for _, f := range fields {
		h[f.name] = append(h[f.name], f.value)
	}
	if signed {
		h[trailerSigName] = []string{sig}
	}
	s.trailer = h
	return s.finish(eof)
}

// parseTrailerLine splits `name:value`; the name is lower-cased, the value
// trimmed. A value with control characters (other than tab) is malformed, as
// in any HTTP field: the caller may echo a checksum back in a header.
func parseTrailerLine(line []byte) (name, value string, ok bool) {
	n, v, found := bytes.Cut(line, []byte{':'})
	if !found || !isToken(string(n)) {
		return "", "", false
	}
	for _, c := range v {
		if c < 0x20 && c != '\t' || c == 0x7f {
			return "", "", false
		}
	}
	return strings.ToLower(string(n)), string(bytes.Trim(v, " \t")), true
}

// verifyTrailer checks the trailer signature over the canonical trailer.
func (s *StreamReader) verifyTrailer(fields []trailerField, provided string) error {
	sts := trailerStringToSign(s.amzDate, s.scope, s.prevSig, fields)
	want := hmacHex(s.key, sts)
	if subtle.ConstantTimeCompare([]byte(want), []byte(provided)) != 1 {
		return errStreamSignature("trailer")
	}
	s.prevSig = want
	return nil
}

func trailerStringToSign(amzDate, scope, prevSig string, fields []trailerField) string {
	return trailerAlgorithm + "\n" + amzDate + "\n" + scope + "\n" + prevSig + "\n" +
		sha256Hex([]byte(canonicalTrailer(fields)))
}

// canonicalTrailer is the signed form of the trailer headers, as the AWS SDKs
// build it: lower-case names in sorted order, values trimmed, the values of a
// repeated name joined with ',', one `name:value\n` line each.
func canonicalTrailer(fields []trailerField) string {
	sorted := append([]trailerField(nil), fields...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].name < sorted[j].name })
	var b strings.Builder
	for i := 0; i < len(sorted); {
		b.WriteString(sorted[i].name)
		b.WriteByte(':')
		j := i
		for ; j < len(sorted) && sorted[j].name == sorted[i].name; j++ {
			if j > i {
				b.WriteByte(',')
			}
			b.WriteString(trimAll(sorted[j].value))
		}
		b.WriteByte('\n')
		i = j
	}
	return b.String()
}

// finish marks the body decoded. Unless the body already ended, nothing may
// follow the terminator.
func (s *StreamReader) finish(eof bool) error {
	s.state = stDone
	if eof {
		return nil
	}
	if _, err := s.br.ReadByte(); err == nil {
		return errStreamFraming("data follows the end of the aws-chunked body")
	} else if err != io.EOF {
		return s.readErr(err, "the body ended early")
	}
	return nil
}

// readLine reads one CRLF-terminated line and returns it without the CRLF;
// the slice is valid until the next read. atEOF reports a clean end of the
// body before the line's first byte (err is then an IncompleteBody).
func (s *StreamReader) readLine() (line []byte, atEOF bool, err error) {
	line, err = s.br.ReadSlice('\n')
	if err != nil {
		switch {
		case errors.Is(err, bufio.ErrBufferFull):
			return nil, false, errStreamLimit("a chunk header or trailer line is longer than 4 KiB")
		case err == io.EOF && len(line) == 0:
			return nil, true, errStreamFraming("the body ended before the aws-chunked framing was complete")
		}
		return nil, false, s.readErr(err, "the body ended inside a line")
	}
	if len(line) > maxLine {
		return nil, false, errStreamLimit("a chunk header or trailer line is longer than 4 KiB")
	}
	if len(line) < 2 || line[len(line)-2] != '\r' {
		return nil, false, errStreamFraming("a line is not terminated by CRLF")
	}
	return line[:len(line)-2], false, nil
}

func (s *StreamReader) readCRLF() error {
	cr, err := s.br.ReadByte()
	if err != nil {
		return s.readErr(err, "the body ended after chunk data")
	}
	lf, err := s.br.ReadByte()
	if err != nil {
		return s.readErr(err, "the body ended after chunk data")
	}
	if cr != '\r' || lf != '\n' {
		return errStreamFraming(fmt.Sprintf("chunk %d data is not followed by CRLF", s.chunk))
	}
	return nil
}

// readErr maps an end of input to IncompleteBody and passes other errors of
// the underlying reader through unchanged.
func (s *StreamReader) readErr(err error, detail string) error {
	if err == io.EOF || err == io.ErrUnexpectedEOF {
		return errStreamFraming(detail)
	}
	return err
}
