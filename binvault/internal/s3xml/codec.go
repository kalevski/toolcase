package s3xml

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// Standard S3 messages for the codes Decode returns.
const (
	msgMalformedXML  = "The XML you provided was not well-formed or did not validate against our published schema"
	msgEmptyBody     = "Request Body is empty"
	msgBodyTooLarge  = "The XML request body exceeds the maximum allowed size"
	msgIncomplete    = "You did not provide the number of bytes specified by the Content-Length HTTP header"
	msgRequestIdle   = "Your socket connection to the server was not read from or written to within the timeout period."
	msgInternalError = "We encountered an internal error. Please try again."
)

// namespaced lists the root elements S3 writes with xmlns=NS. Request roots
// are included because SDKs send them namespaced (useful to clients and tests);
// <Error> is deliberately absent.
var namespaced = map[string]bool{
	"AccessControlPolicy":               true,
	"BucketLoggingStatus":               true,
	"CompleteMultipartUpload":           true,
	"CompleteMultipartUploadResult":     true,
	"CopyObjectResult":                  true,
	"CopyPartResult":                    true,
	"CORSConfiguration":                 true,
	"CreateBucketConfiguration":         true,
	"Delete":                            true,
	"DeleteResult":                      true,
	"GetObjectAttributesResponse":       true,
	"InitiateMultipartUploadResult":     true,
	"LifecycleConfiguration":            true,
	"ListAllMyBucketsResult":            true,
	"ListBucketResult":                  true,
	"ListMultipartUploadsResult":        true,
	"ListPartsResult":                   true,
	"ListVersionsResult":                true,
	"LocationConstraint":                true,
	"NotificationConfiguration":         true,
	"PostResponse":                      true,
	"RequestPaymentConfiguration":       true,
	"ServerSideEncryptionConfiguration": true,
	"Tagging":                           true,
	"VersioningConfiguration":           true,
}

var xmlNameType = reflect.TypeOf(xml.Name{})

// Marshal renders v as a complete S3 XML document: the declaration
// `<?xml version="1.0" encoding="UTF-8"?>`, a newline, and the root element
// (compact, as S3 sends it). Roots that S3 namespaces get xmlns=NS. Text that
// XML 1.0 cannot carry is an *InvalidCharError, never silently replaced.
func Marshal(v any) ([]byte, error) {
	body, err := MarshalElement(v)
	if err != nil {
		return nil, err
	}
	out := make([]byte, 0, len(xml.Header)+len(body))
	out = append(out, xml.Header...)
	return append(out, body...), nil
}

// MarshalElement is Marshal without the XML declaration. A response that has
// already sent its 200 status and the declaration, followed by whitespace
// keep-alives (CopyObject and CompleteMultipartUpload, spec §5.4.5 and §5.6),
// finishes with these bytes.
func MarshalElement(v any) ([]byte, error) {
	rv := reflect.ValueOf(v)
	for rv.Kind() == reflect.Pointer || rv.Kind() == reflect.Interface {
		if rv.IsNil() {
			return nil, errors.New("s3xml: cannot marshal a nil value")
		}
		rv = rv.Elem()
	}
	if !rv.IsValid() {
		return nil, errors.New("s3xml: cannot marshal a nil value")
	}
	if err := checkText(rv, 0); err != nil {
		var ice *InvalidCharError
		if errors.As(err, &ice) {
			ice.prefix(rv.Type().Name())
		}
		return nil, err
	}
	var buf bytes.Buffer
	enc := xml.NewEncoder(&buf)
	var err error
	if start, ok := rootStart(rv.Type()); ok {
		err = enc.EncodeElement(v, start)
	} else {
		err = enc.Encode(v)
	}
	if err == nil {
		err = enc.Close()
	}
	if err != nil {
		return nil, fmt.Errorf("s3xml: %w", err)
	}
	out := buf.Bytes()
	// encoding/xml escapes '"' as &#34; and '\'' as &#39;. S3 writes &quot;
	// (every ETag carries two) and a bare apostrophe; match it. This is safe
	// on the encoder's output: a literal "&#34;" in a value is written as
	// "&amp;#34;", so these sequences only ever come from the encoder; all
	// attributes are double-quoted, and no wire type uses CDATA or comments,
	// where they would be literal text.
	if bytes.Contains(out, []byte("&#3")) {
		out = bytes.ReplaceAll(out, []byte("&#34;"), []byte("&quot;"))
		out = bytes.ReplaceAll(out, []byte("&#39;"), []byte("'"))
	}
	return out, nil
}

// rootStart returns the namespaced start element for struct types whose
// XMLName tag names a root that S3 namespaces.
func rootStart(t reflect.Type) (xml.StartElement, bool) {
	if t.Kind() != reflect.Struct {
		return xml.StartElement{}, false
	}
	f, ok := t.FieldByName("XMLName")
	if !ok || f.Type != xmlNameType {
		return xml.StartElement{}, false
	}
	name, _, _ := strings.Cut(f.Tag.Get("xml"), ",")
	if strings.Contains(name, " ") || !namespaced[name] {
		return xml.StartElement{}, false // already namespaced by its tag, or not an S3 root
	}
	return xml.StartElement{Name: xml.Name{Space: NS, Local: name}}, true
}

// InvalidCharError reports text that an XML 1.0 document cannot carry:
// invalid UTF-8, or a character outside the XML Char production (most C0
// controls, U+FFFE, U+FFFF). S3 keys may contain such characters (anything but
// NUL, spec §3.7); listings must then be requested with encoding-type=url.
type InvalidCharError struct {
	// Field is the path of the offending value, e.g. "ListBucketResultV2.Contents[3].Key".
	Field string
	// Offset is the byte offset of the first offending character in the value.
	Offset int
}

// Error names the field and points at encoding-type=url.
func (e *InvalidCharError) Error() string {
	return fmt.Sprintf("s3xml: %s contains a character XML 1.0 cannot carry at byte %d (keys like this need encoding-type=url)", e.Field, e.Offset)
}

func (e *InvalidCharError) prefix(p string) {
	switch {
	case p == "":
	case e.Field == "":
		e.Field = p
	case strings.HasPrefix(e.Field, "["):
		e.Field = p + e.Field
	default:
		e.Field = p + "." + e.Field
	}
}

// checkText walks every exported string reachable from v (struct fields,
// slices, maps, pointers) and reports the first one XML 1.0 cannot carry.
// encoding/xml would replace such characters with U+FFFD, which turns a key
// into a different key; failing is the only honest answer.
func checkText(v reflect.Value, depth int) error {
	if depth > 32 {
		return nil // the wire types are shallow; this only guards against cycles
	}
	switch v.Kind() {
	case reflect.String:
		if i := invalidAt(v.String()); i >= 0 {
			return &InvalidCharError{Offset: i}
		}
	case reflect.Pointer, reflect.Interface:
		if !v.IsNil() {
			return checkText(v.Elem(), depth+1)
		}
	case reflect.Struct:
		if v.Type() == timeType {
			return nil
		}
		t := v.Type()
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if !f.IsExported() {
				continue
			}
			if err := checkText(v.Field(i), depth+1); err != nil {
				var ice *InvalidCharError
				if errors.As(err, &ice) {
					ice.prefix(f.Name)
				}
				return err
			}
		}
	case reflect.Slice, reflect.Array:
		if v.Type().Elem().Kind() == reflect.Uint8 {
			if i := invalidAt(string(v.Bytes())); i >= 0 {
				return &InvalidCharError{Offset: i}
			}
			return nil
		}
		for i := 0; i < v.Len(); i++ {
			if err := checkText(v.Index(i), depth+1); err != nil {
				var ice *InvalidCharError
				if errors.As(err, &ice) {
					ice.prefix("[" + strconv.Itoa(i) + "]")
				}
				return err
			}
		}
	case reflect.Map:
		iter := v.MapRange()
		for iter.Next() {
			for _, x := range []reflect.Value{iter.Key(), iter.Value()} {
				if err := checkText(x, depth+1); err != nil {
					var ice *InvalidCharError
					if errors.As(err, &ice) {
						ice.prefix(fmt.Sprintf("[%v]", iter.Key()))
					}
					return err
				}
			}
		}
	}
	return nil
}

// isXMLChar reports whether r is in the XML 1.0 Char production.
func isXMLChar(r rune) bool {
	switch {
	case r == '\t' || r == '\n' || r == '\r':
		return true
	case r >= 0x20 && r <= 0xD7FF:
		return true
	case r >= 0xE000 && r <= 0xFFFD:
		return true
	case r >= 0x10000 && r <= utf8.MaxRune:
		return true
	}
	return false
}

// invalidAt returns the byte offset of the first character of s that XML 1.0
// cannot carry, or -1.
func invalidAt(s string) int {
	for i := 0; i < len(s); {
		c := s[i]
		if c < utf8.RuneSelf {
			if c < 0x20 && c != '\t' && c != '\n' && c != '\r' {
				return i
			}
			i++
			continue
		}
		r, w := utf8.DecodeRuneInString(s[i:])
		if (r == utf8.RuneError && w == 1) || !isXMLChar(r) {
			return i
		}
		i += w
	}
	return -1
}

// ValidXMLText reports whether s is valid UTF-8 made only of characters an
// XML 1.0 document can carry. A listing without encoding-type=url can only
// include keys for which this holds.
func ValidXMLText(s string) bool { return invalidAt(s) < 0 }

// CleanXMLText replaces every invalid UTF-8 byte and every character XML 1.0
// cannot carry with U+FFFD. It is lossy: use it for messages, never for keys a
// client will send back.
func CleanXMLText(s string) string {
	i := invalidAt(s)
	if i < 0 {
		return s
	}
	var b strings.Builder
	b.Grow(len(s) + 8)
	b.WriteString(s[:i])
	for i < len(s) {
		r, w := utf8.DecodeRuneInString(s[i:])
		if (r == utf8.RuneError && w == 1) || !isXMLChar(r) {
			b.WriteRune(utf8.RuneError)
		} else {
			b.WriteString(s[i : i+w])
		}
		i += w
	}
	return b.String()
}

// Decode reads an XML request body of at most limit bytes (MaxRequestBytes
// when limit <= 0) from r and decodes it into v, which must be a non-nil
// pointer. The root element may carry the S3 namespace, another namespace or
// none. Every error is an *apierr.Error:
//
//   - MissingRequestBodyError for an empty (or all-whitespace) body;
//   - EntityTooLarge when the body exceeds limit;
//   - MalformedXML for anything that is not one well-formed document of the
//     expected shape, including DOCTYPE or entity declarations, processing
//     instructions other than the XML declaration, a non-UTF-8 encoding,
//     invalid characters, nesting deeper than MaxDepth, or content after the
//     root element;
//   - an *apierr.Error returned by r itself (for example from an aws-chunked
//     decoder) is passed through; a timeout is RequestTimeout and any other
//     read error IncompleteBody.
func Decode(r io.Reader, v any, limit int64) error {
	if rv := reflect.ValueOf(v); rv.Kind() != reflect.Pointer || rv.IsNil() {
		return apierr.Wrap("InternalError", msgInternalError, errors.New("s3xml.Decode needs a non-nil pointer"))
	}
	data, err := readBody(r, limit)
	if err != nil {
		return err
	}
	if isXMLSpace(data) {
		return apierr.New("MissingRequestBodyError", msgEmptyBody)
	}
	return decodeBytes(data, v)
}

// DecodeCreateBucket reads a CreateBucket request body and returns its
// location constraint. An empty body (what SDKs send for us-east-1) yields "".
// Both a <CreateBucketConfiguration> document and a bare <LocationConstraint>
// root are accepted, with or without the S3 namespace.
func DecodeCreateBucket(r io.Reader, limit int64) (string, error) {
	data, err := readBody(r, limit)
	if err != nil {
		return "", err
	}
	if isXMLSpace(data) {
		return "", nil
	}
	var doc struct {
		XMLName  xml.Name
		Location string `xml:"LocationConstraint"`
		Text     string `xml:",chardata"`
	}
	if err := decodeBytes(data, &doc); err != nil {
		return "", err
	}
	switch doc.XMLName.Local {
	case "CreateBucketConfiguration":
		return strings.TrimSpace(doc.Location), nil
	case "LocationConstraint":
		return strings.TrimSpace(doc.Text), nil
	}
	return "", malformed(fmt.Errorf("unexpected root element <%s>", doc.XMLName.Local))
}

// readBody reads at most limit bytes, mapping failures to S3 errors.
func readBody(r io.Reader, limit int64) ([]byte, error) {
	if limit <= 0 {
		limit = MaxRequestBytes
	}
	if r == nil {
		return nil, nil
	}
	data, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		if ae, ok := apierr.As(err); ok {
			return nil, ae
		}
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return nil, apierr.Wrap("EntityTooLarge", msgBodyTooLarge, err)
		}
		var te interface{ Timeout() bool }
		if errors.As(err, &te) && te.Timeout() {
			return nil, apierr.Wrap("RequestTimeout", msgRequestIdle, err)
		}
		return nil, apierr.Wrap("IncompleteBody", msgIncomplete, err)
	}
	if int64(len(data)) > limit {
		return nil, apierr.New("EntityTooLarge", msgBodyTooLarge)
	}
	return data, nil
}

func malformed(cause error) *apierr.Error {
	return apierr.Wrap("MalformedXML", msgMalformedXML, cause)
}

// decodeBytes decodes one guarded document from data into v and checks that
// nothing but whitespace and comments follows the root element.
func decodeBytes(data []byte, v any) error {
	g := &guard{d: xml.NewDecoder(bytes.NewReader(data)), prolog: true}
	dec := xml.NewTokenDecoder(g)
	if err := dec.Decode(v); err != nil {
		if errors.Is(err, io.EOF) {
			err = errors.New("no root element")
		}
		return malformed(err)
	}
	for {
		_, err := dec.Token() // the guard rejects anything but whitespace and comments here
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return malformed(err)
		}
	}
}

var (
	errDirective = errors.New("DTDs and entity declarations are not allowed")
	errProcInst  = errors.New("processing instructions are not allowed")
	errTooDeep   = fmt.Errorf("elements nested deeper than %d levels", MaxDepth)
	errOutside   = errors.New("content outside the root element")
	bom          = []byte{0xEF, 0xBB, 0xBF} // UTF-8 byte-order mark
)

// guard sits between the byte-level decoder and the decoder that fills Go
// values. It sees raw tokens (the outer decoder still checks nesting and
// resolves namespaces) and refuses what an S3 request never contains.
// encoding/xml expands no custom entities and fetches nothing, so this is
// defence in depth against billion-laughs and XXE as much as strictness.
type guard struct {
	d      *xml.Decoder
	depth  int
	root   bool // the root element has been opened
	prolog bool // nothing but a byte-order mark seen yet: the XML declaration is still allowed
}

func (g *guard) Token() (xml.Token, error) {
	tok, err := g.d.RawToken()
	if tok == nil {
		return nil, err
	}
	tok = xml.CopyToken(tok)
	prolog := g.prolog
	g.prolog = false
	switch t := tok.(type) {
	case xml.StartElement:
		if g.depth == 0 && g.root {
			return nil, errOutside // a second root
		}
		g.root = true
		g.depth++
		if g.depth > MaxDepth {
			return nil, errTooDeep
		}
	case xml.EndElement:
		g.depth--
	case xml.Directive:
		return nil, errDirective
	case xml.ProcInst:
		if t.Target != "xml" || !prolog {
			return nil, errProcInst
		}
	case xml.CharData:
		if g.depth == 0 {
			s := []byte(t)
			if prolog && bytes.HasPrefix(s, bom) {
				s = s[len(bom):]
				g.prolog = len(s) == 0
			}
			if !isXMLSpace(s) {
				return nil, errOutside
			}
		}
	}
	return tok, err
}

// isXMLSpace reports whether b holds only XML whitespace (space, tab, CR, LF).
func isXMLSpace(b []byte) bool {
	for _, c := range b {
		if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
			return false
		}
	}
	return true
}
