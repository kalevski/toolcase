package s3xml

import (
	"encoding/xml"
	"sort"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// ErrorDoc is the S3 <Error> document (spec §5.11). Unlike every other S3
// root it has no namespace. Elements are written in S3's order: Code,
// Message, the extra fields, Resource, RequestId, HostId.
type ErrorDoc struct {
	Code    string
	Message string
	// Extra holds the code-specific fields S3 adds (Key, BucketName, VersionId,
	// UploadId, Condition, Method, ResourceType, ArgumentName, ...). Well-known
	// names are written in S3's order, the rest sorted by name. Names that are
	// not plain XML names, or that collide with the fixed fields, are dropped.
	Extra     map[string]string `xml:"-"`
	Resource  string
	RequestID string
	HostID    string
}

// extraOrder is the order in which S3 writes the extra fields it uses.
var extraOrder = []string{
	"Key", "BucketName", "VersionId", "UploadId", "PartNumber", "ETag",
	"Condition", "Method", "ResourceType", "ArgumentName", "ArgumentValue",
	"AWSAccessKeyId", "StringToSign", "SignatureProvided", "StringToSignBytes",
	"CanonicalRequest", "CanonicalRequestBytes", "RequestTime", "ServerTime",
	"MaxAllowedSkewMilliseconds", "X-Amz-Expires", "Expires", "ProposedSize",
	"MinSizeAllowed", "MaxSizeAllowed", "RangeRequested", "ActualObjectSize",
	"Header", "HeaderName", "HeaderValue",
}

var extraRank = func() map[string]int {
	m := make(map[string]int, len(extraOrder))
	for i, n := range extraOrder {
		m[n] = i
	}
	return m
}()

var errorFixed = map[string]bool{"Code": true, "Message": true, "Resource": true, "RequestId": true, "HostId": true}

// MarshalXML implements xml.Marshaler.
func (e ErrorDoc) MarshalXML(enc *xml.Encoder, _ xml.StartElement) error {
	start := xml.StartElement{Name: xml.Name{Local: "Error"}}
	if err := enc.EncodeToken(start); err != nil {
		return err
	}
	put := func(name, value string) error {
		return enc.EncodeElement(value, xml.StartElement{Name: xml.Name{Local: name}})
	}
	if err := put("Code", e.Code); err != nil {
		return err
	}
	if err := put("Message", e.Message); err != nil {
		return err
	}
	for _, name := range e.extraNames() {
		if err := put(name, e.Extra[name]); err != nil {
			return err
		}
	}
	for _, f := range []struct{ name, value string }{{"Resource", e.Resource}, {"RequestId", e.RequestID}, {"HostId", e.HostID}} {
		if f.value == "" {
			continue
		}
		if err := put(f.name, f.value); err != nil {
			return err
		}
	}
	return enc.EncodeToken(start.End())
}

func (e ErrorDoc) extraNames() []string {
	names := make([]string, 0, len(e.Extra))
	for name := range e.Extra {
		if !errorFixed[name] && isPlainName(name) {
			names = append(names, name)
		}
	}
	sort.Slice(names, func(i, j int) bool {
		ri, iok := extraRank[names[i]]
		rj, jok := extraRank[names[j]]
		switch {
		case iok && jok:
			return ri < rj
		case iok != jok:
			return iok
		}
		return names[i] < names[j]
	})
	return names
}

// isPlainName reports whether s is an XML name without a colon:
// [A-Za-z_][A-Za-z0-9._-]*.
func isPlainName(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c == '_':
		case i > 0 && (c >= '0' && c <= '9' || c == '.' || c == '-'):
		default:
			return false
		}
	}
	return true
}

// UnmarshalXML implements xml.Unmarshaler: fixed fields by name, every other
// child element into Extra.
func (e *ErrorDoc) UnmarshalXML(d *xml.Decoder, _ xml.StartElement) error {
	*e = ErrorDoc{}
	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			var s string
			if err := d.DecodeElement(&s, &t); err != nil {
				return err
			}
			switch t.Name.Local {
			case "Code":
				e.Code = s
			case "Message":
				e.Message = s
			case "Resource":
				e.Resource = s
			case "RequestId":
				e.RequestID = s
			case "HostId":
				e.HostID = s
			default:
				if e.Extra == nil {
					e.Extra = map[string]string{}
				}
				e.Extra[t.Name.Local] = s
			}
		case xml.EndElement:
			return nil
		}
	}
}

// NewErrorDoc builds the document for e. resource is the request's resource
// (e.g. "/photos/a.png"); a Resource set on e wins over it. A nil e, or one
// without a code, is an InternalError.
func NewErrorDoc(e *apierr.Error, requestID, resource string) ErrorDoc {
	if e == nil {
		e = apierr.New("InternalError", msgInternalError)
	}
	doc := ErrorDoc{Code: e.Code, Message: e.Message, Extra: e.Extra, Resource: resource, RequestID: requestID}
	if e.Resource != "" {
		doc.Resource = e.Resource
	}
	if doc.Code == "" {
		doc.Code = "InternalError"
		if doc.Message == "" {
			doc.Message = msgInternalError
		}
	}
	return doc
}

// FromAPIError renders e as a complete <Error> document (XML declaration
// included) for requestID and resource: NewErrorDoc(e, requestID,
// resource).Bytes(). The HTTP status is e.Status; HEAD responses send no body
// at all (spec §5.1).
func FromAPIError(e *apierr.Error, requestID, resource string) []byte {
	return NewErrorDoc(e, requestID, resource).Bytes()
}

// Bytes renders d as a complete document. Unlike Marshal it never fails: text
// XML 1.0 cannot carry (a key with control characters echoed in <Key>, say) is
// replaced with U+FFFD and unusable extra names are dropped, because an error
// must always reach the client. After an early 200 with keep-alives (spec
// §5.4.5), write it without the declaration:
// bytes.TrimPrefix(d.Bytes(), []byte(xml.Header)).
func (d ErrorDoc) Bytes() []byte {
	d.Code = CleanXMLText(d.Code)
	d.Message = CleanXMLText(d.Message)
	d.Resource = CleanXMLText(d.Resource)
	d.RequestID = CleanXMLText(d.RequestID)
	d.HostID = CleanXMLText(d.HostID)
	if len(d.Extra) > 0 {
		extra := make(map[string]string, len(d.Extra))
		for k, v := range d.Extra {
			if !errorFixed[k] && isPlainName(k) {
				extra[k] = CleanXMLText(v)
			}
		}
		d.Extra = extra
	}
	out, err := Marshal(d)
	if err != nil {
		return []byte(xml.Header + "<Error><Code>InternalError</Code><Message>" + msgInternalError + "</Message></Error>")
	}
	return out
}
