package s3xml

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"time"
)

// TimeFormat is the timestamp layout of S3 XML elements (spec §5.1): always
// UTC, with a millisecond field that is always .000, as S3 writes it (see Time).
const TimeFormat = "2006-01-02T15:04:05.000Z"

// Time is a timestamp element (LastModified, CreationDate, Initiated, ...).
// It marshals as TimeFormat in UTC, truncated to the whole second like S3,
// whose object times have second resolution: the Last-Modified header and the
// listings then agree, which is what `aws s3 sync --exact-timestamps` compares.
// It unmarshals leniently: RFC 3339 with or without a fraction and with any
// offset, or a zone-less timestamp taken as UTC. Convert with Time(t) and
// time.Time(x).
type Time time.Time

var timeType = reflect.TypeOf(Time{})

// MarshalText implements encoding.TextMarshaler.
func (t Time) MarshalText() ([]byte, error) {
	return []byte(t.String()), nil
}

// UnmarshalText implements encoding.TextUnmarshaler. An empty element is the
// zero time.
func (t *Time) UnmarshalText(b []byte) error {
	s := strings.TrimSpace(string(b))
	if s == "" {
		*t = Time{}
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999999999"} {
		if v, err := time.Parse(layout, s); err == nil {
			*t = Time(v.UTC())
			return nil
		}
	}
	return fmt.Errorf("s3xml: invalid timestamp %q", s)
}

// String returns the timestamp in TimeFormat, truncated to the whole second.
func (t Time) String() string { return time.Time(t).UTC().Truncate(time.Second).Format(TimeFormat) }

// httpDateLayouts are the HTTP-date forms of RFC 9110 §5.6.7 (IMF-fixdate,
// obsolete RFC 850, asctime), plus RFC 1123 with a numeric offset or "UTC",
// which some clients send. Zone abbreviations other than GMT and UTC are not
// accepted: Go would read them as offset zero.
var httpDateLayouts = []string{
	http.TimeFormat,                  // Sun, 06 Nov 1994 08:49:37 GMT
	"Monday, 02-Jan-06 15:04:05 GMT", // Sunday, 06-Nov-94 08:49:37 GMT
	time.ANSIC,                       // Sun Nov  6 08:49:37 1994
	"Mon, _2 Jan 2006 15:04:05 GMT",  // single-digit day
	"Mon, 02 Jan 2006 15:04:05 UTC",  // UTC spelled out
	time.RFC1123Z,                    // Sun, 06 Nov 1994 08:49:37 +0000
}

// HTTPDate formats t as an HTTP-date (RFC 9110 IMF-fixdate, always GMT), the
// form of Last-Modified, Date, Expires and the x-amz-expiration expiry-date.
func HTTPDate(t time.Time) string { return t.UTC().Format(http.TimeFormat) }

// ParseHTTPDate parses an HTTP-date header (If-Modified-Since, Expires, ...)
// in any of the three RFC 9110 forms, returning the time in UTC. ok is false
// for anything else, which callers of conditional headers ignore (RFC 9110).
func ParseHTTPDate(s string) (t time.Time, ok bool) {
	s = strings.TrimSpace(s)
	for _, layout := range httpDateLayouts {
		if v, err := time.Parse(layout, s); err == nil {
			return v.UTC(), true
		}
	}
	return time.Time{}, false
}
