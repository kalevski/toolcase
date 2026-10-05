package s3

import (
	"bytes"
	"encoding/xml"
	"net/http"
	"strconv"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

// slowAfter is how long CopyObject and CompleteMultipartUpload run before
// binvault commits to a 200 and keeps the connection alive with whitespace
// (spec §5.4.5, §5.6).
const slowAfter = 10 * time.Second

// keepaliveEvery is the whitespace cadence once the response is committed.
const keepaliveEvery = 5 * time.Second

// result is what a slow operation produces.
type opResult struct {
	body    any                 // the response document
	headers func(h http.Header) // headers to set (only possible before the early 200)
	err     error
}

// runWithKeepalive runs fn. If it finishes within slowAfter, the answer is a
// normal response (headers, status 200 or the error). Otherwise the response is
// committed early as `200` with the XML declaration, whitespace is sent until fn
// finishes, and its outcome — the document, or an <Error> document — is written
// into the body. After the early 200 the headers and status can no longer
// carry the outcome (spec §5.4.5).
func (s *Server) runWithKeepalive(rc *reqCtx, fn func() opResult) error {
	done := make(chan opResult, 1)
	go func() { done <- fn() }()

	timer := time.NewTimer(slowAfter)
	defer timer.Stop()
	select {
	case res := <-done:
		if res.err != nil {
			return res.err
		}
		if res.headers != nil {
			res.headers(rc.w.Header())
		}
		return s.writeXML(rc, http.StatusOK, res.body)
	case <-rc.ctx.Done():
		return rc.ctx.Err()
	case <-timer.C:
	}

	h := rc.w.Header()
	h.Set("Content-Type", s3xml.ContentType)
	h.Del("Content-Length")
	rc.w.WriteHeader(http.StatusOK)
	_, _ = rc.w.Write([]byte(xml.Header))
	flush := func() {
		if f, ok := rc.w.(http.Flusher); ok {
			f.Flush()
		}
	}
	flush()
	tick := time.NewTicker(keepaliveEvery)
	defer tick.Stop()
	for {
		select {
		case res := <-done:
			var out []byte
			if res.err != nil {
				ae := toAPIError(res.err)
				rc.info.ErrCode = ae.Code
				doc := s3xml.FromAPIError(ae, rc.info.ID, "/"+rc.t.Bucket+"/"+rc.t.Key)
				out = bytes.TrimPrefix(doc, []byte(xml.Header))
			} else {
				var err error
				out, err = s3xml.MarshalElement(res.body)
				if err != nil {
					out = bytes.TrimPrefix(s3xml.FromAPIError(toAPIError(err), rc.info.ID, ""), []byte(xml.Header))
				}
			}
			_, _ = rc.w.Write(out)
			return nil
		case <-tick.C:
			if _, err := rc.w.Write([]byte(" ")); err != nil {
				return err
			}
			flush()
		case <-rc.ctx.Done():
			return rc.ctx.Err()
		}
	}
}

var _ = strconv.Itoa
