package gateway

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/session"
)

var reID = regexp.MustCompile(`^[A-Za-z0-9_.\-]{1,255}$`)

func (g *Gateway) handleJMAP(w http.ResponseWriter, r *http.Request, a *session.Active) {
	if ct := r.Header.Get("Content-Type"); ct != "" {
		if mt, _, err := mime.ParseMediaType(ct); err != nil || mt != "application/json" {
			httpx.Error(w, r, http.StatusUnsupportedMediaType, "bad_content_type", "JMAP requests must be application/json.")
			return
		}
	}
	r.Body = http.MaxBytesReader(w, r.Body, jmap.MaxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			httpx.Error(w, r, http.StatusRequestEntityTooLarge, "too_large", "The request is too large.")
			return
		}
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Could not read the request.")
		return
	}
	acct, err := g.accountID(r.Context(), r, a)
	if err != nil {
		g.upstreamFailed(w, r, a, "jmap", err)
		return
	}
	filtered, v := jmap.Filter(body, acct)
	if v != nil {
		g.count("jmap", "rejected")
		httpx.Error(w, r, v.Status, v.Code, v.Message)
		return
	}
	doc, err := g.sessionDoc(r.Context(), r, a, false)
	if err != nil {
		g.upstreamFailed(w, r, a, "jmap", err)
		return
	}
	data, status, err := g.client(r.Context(), a).Call(r.Context(), doc, a.Address, a.Credential, g.clientIP(r), filtered)
	if err != nil {
		g.upstreamFailed(w, r, a, "jmap", err)
		return
	}
	switch {
	case status == http.StatusOK:
		g.count("jmap", "ok")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	case status >= 400 && status < 500 && status != http.StatusForbidden:
		// RFC 7807 problem details from the server (e.g. limit): pass on.
		g.count("jmap", "client_error")
		w.Header().Set("Content-Type", "application/problem+json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(status)
		_, _ = w.Write(data)
	default:
		g.count("jmap", "error")
		g.Log.Warn("upstream jmap status", "status", status, "session", a.PublicID)
		httpx.Error(w, r, http.StatusBadGateway, "upstream_error", "The mail server could not process the request.")
	}
}

// safeImage are the media types served inline; everything else is an
// attachment (spec §3.6). SVG is deliberately absent.
var safeImage = map[string]bool{"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true, "image/bmp": true}

func cleanMediaType(raw string) string {
	mt, _, err := mime.ParseMediaType(raw)
	if err != nil || mt == "" || len(mt) > 127 {
		return "application/octet-stream"
	}
	return mt
}

// safeFilename keeps a download name printable and free of separators.
func safeFilename(s string) string {
	s = strings.Map(func(r rune) rune {
		switch {
		case r < 0x20 || r == 0x7f || r == '/' || r == '\\' || r == '"' || r == ';' || r == '%':
			return '_'
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > 200 {
		s = string(r[:200])
	}
	if s == "" || s == "." || s == ".." {
		return "download"
	}
	return s
}

const (
	streamChunkDeadline = 60 * time.Second
	uploadDeadline      = 15 * time.Minute
)

func extendDeadlines(w http.ResponseWriter, read, write time.Duration) {
	rc := http.NewResponseController(w)
	now := time.Now()
	if read > 0 {
		_ = rc.SetReadDeadline(now.Add(read))
	}
	if write > 0 {
		_ = rc.SetWriteDeadline(now.Add(write))
	}
}

func copyWithDeadline(w http.ResponseWriter, src io.Reader) {
	rc := http.NewResponseController(w)
	buf := make([]byte, 32<<10)
	for {
		n, err := src.Read(buf)
		if n > 0 {
			_ = rc.SetWriteDeadline(time.Now().Add(streamChunkDeadline))
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}

func (g *Gateway) handleDownload(w http.ResponseWriter, r *http.Request, a *session.Active) {
	accountID, blobID, name := r.PathValue("accountId"), r.PathValue("blobId"), r.PathValue("name")
	acct, err := g.accountID(r.Context(), r, a)
	if err != nil {
		g.upstreamFailed(w, r, a, "download", err)
		return
	}
	if accountID != acct {
		httpx.Error(w, r, http.StatusForbidden, "account_not_allowed", "That account is not yours.")
		return
	}
	if !reID.MatchString(blobID) {
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Invalid blob id.")
		return
	}
	ctype := cleanMediaType(r.URL.Query().Get("type"))
	doc, err := g.sessionDoc(r.Context(), r, a, false)
	if err != nil {
		g.upstreamFailed(w, r, a, "download", err)
		return
	}
	target, err := g.client(r.Context(), a).Resolve(jmap.ExpandTemplate(doc.DownloadURL, map[string]string{
		"accountId": acct, "blobId": blobID, "name": safeFilename(name), "type": ctype}))
	if err != nil {
		g.upstreamFailed(w, r, a, "download", err)
		return
	}
	req, err := g.client(r.Context(), a).Request(r.Context(), a.Address, a.Credential, http.MethodGet, target, nil, g.clientIP(r))
	if err != nil {
		g.upstreamFailed(w, r, a, "download", err)
		return
	}
	if rg := r.Header.Get("Range"); rg != "" {
		req.Header.Set("Range", rg)
	}
	resp, err := g.client(r.Context(), a).Do(req)
	if err != nil {
		g.upstreamFailed(w, r, a, "download", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "The attachment was not found.")
		return
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		g.count("download", "error")
		httpx.Error(w, r, http.StatusBadGateway, "upstream_error", "The mail server could not deliver the file.")
		return
	}
	g.count("download", "ok")
	h := w.Header()
	// The type comes from the message (attacker-influenced): the browser is
	// told what to do, never to guess.
	h.Set("Content-Type", ctype)
	disp := "attachment"
	if safeImage[ctype] {
		disp = "inline"
	}
	fn := safeFilename(name)
	h.Set("Content-Disposition", disp+"; filename*=UTF-8''"+url.PathEscape(fn))
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	h.Set("Cache-Control", "private, max-age=3600")
	for _, k := range []string{"Content-Length", "Content-Range", "Accept-Ranges"} {
		if v := resp.Header.Get(k); v != "" {
			h.Set(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	copyWithDeadline(w, resp.Body)
}

func (g *Gateway) handleUpload(w http.ResponseWriter, r *http.Request, a *session.Active) {
	accountID := r.PathValue("accountId")
	acct, err := g.accountID(r.Context(), r, a)
	if err != nil {
		g.upstreamFailed(w, r, a, "upload", err)
		return
	}
	if accountID != acct {
		httpx.Error(w, r, http.StatusForbidden, "account_not_allowed", "That account is not yours.")
		return
	}
	if r.ContentLength > g.MaxUploadBytes {
		httpx.Error(w, r, http.StatusRequestEntityTooLarge, "too_large", "The file is larger than the upload limit.")
		return
	}
	doc, err := g.sessionDoc(r.Context(), r, a, false)
	if err != nil {
		g.upstreamFailed(w, r, a, "upload", err)
		return
	}
	target, err := g.client(r.Context(), a).Resolve(jmap.ExpandTemplate(doc.UploadURL, map[string]string{"accountId": acct}))
	if err != nil {
		g.upstreamFailed(w, r, a, "upload", err)
		return
	}
	extendDeadlines(w, uploadDeadline, uploadDeadline+streamChunkDeadline)
	body := http.MaxBytesReader(w, r.Body, g.MaxUploadBytes)
	req, err := g.client(r.Context(), a).Request(r.Context(), a.Address, a.Credential, http.MethodPost, target, body, g.clientIP(r))
	if err != nil {
		g.upstreamFailed(w, r, a, "upload", err)
		return
	}
	req.ContentLength = r.ContentLength
	req.Header.Set("Content-Type", cleanMediaType(r.Header.Get("Content-Type")))
	resp, err := g.client(r.Context(), a).Do(req)
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			httpx.Error(w, r, http.StatusRequestEntityTooLarge, "too_large", "The file is larger than the upload limit.")
			return
		}
		g.upstreamFailed(w, r, a, "upload", err)
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		g.count("upload", "error")
		status := http.StatusBadGateway
		if resp.StatusCode == http.StatusRequestEntityTooLarge {
			status = http.StatusRequestEntityTooLarge
		}
		httpx.Error(w, r, status, "upload_failed", "The mail server rejected the upload.")
		return
	}
	g.count("upload", "ok")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(data)
}

var reTypes = regexp.MustCompile(`^(\*|[A-Za-z]+(,[A-Za-z]+)*)$`)

// maxStream bounds one event-stream connection; the browser reconnects (and
// the session is re-validated) at the end.
const maxStream = 30 * time.Minute

func (g *Gateway) handleEventSource(w http.ResponseWriter, r *http.Request, a *session.Active) {
	q := r.URL.Query()
	types := q.Get("types")
	if types == "" {
		types = "*"
	}
	if len(types) > 400 || !reTypes.MatchString(types) {
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Invalid types.")
		return
	}
	closeafter := "no"
	if q.Get("closeafter") == "state" {
		closeafter = "state"
	}
	ping := 30
	if n, err := strconv.Atoi(q.Get("ping")); err == nil {
		ping = n
	}
	if ping != 0 {
		ping = min(max(ping, 10), 300)
	}
	doc, err := g.sessionDoc(r.Context(), r, a, false)
	if err != nil {
		g.upstreamFailed(w, r, a, "eventsource", err)
		return
	}
	if doc.EventSourceURL == "" {
		httpx.Error(w, r, http.StatusNotImplemented, "no_eventsource", "The mail server offers no push channel.")
		return
	}
	target, err := g.client(r.Context(), a).Resolve(jmap.ExpandTemplate(doc.EventSourceURL, map[string]string{
		"types": types, "closeafter": closeafter, "ping": strconv.Itoa(ping)}))
	if err != nil {
		g.upstreamFailed(w, r, a, "eventsource", err)
		return
	}
	ctx, cancel := contextWithTimeout(r, maxStream)
	defer cancel()
	extendDeadlines(w, maxStream+streamChunkDeadline, maxStream+streamChunkDeadline)
	req, err := g.client(r.Context(), a).Request(ctx, a.Address, a.Credential, http.MethodGet, target, nil, g.clientIP(r))
	if err != nil {
		g.upstreamFailed(w, r, a, "eventsource", err)
		return
	}
	req.Header.Set("Accept", "text/event-stream")
	if id := r.Header.Get("Last-Event-ID"); id != "" && len(id) < 256 {
		req.Header.Set("Last-Event-ID", id)
	}
	resp, err := g.client(r.Context(), a).Do(req)
	if err != nil {
		g.upstreamFailed(w, r, a, "eventsource", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		httpx.Error(w, r, http.StatusBadGateway, "upstream_error", "The push channel is unavailable.")
		return
	}
	g.count("eventsource", "ok")
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-store")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	rc := http.NewResponseController(w)
	_ = rc.Flush()
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			_ = rc.Flush()
		}
		if err != nil {
			return
		}
	}
}
