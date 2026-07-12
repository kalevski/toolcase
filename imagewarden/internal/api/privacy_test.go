package api

import (
	"bytes"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// This file is the regression guard behind spec §8's load-bearing privacy stance:
// "images are processed in memory and never written to disk, never logged, never
// leave the process." That guarantee is the whole justification for the hardened
// `--read-only --cap-drop ALL` runtime (spec §9). Nothing else in the Go suite
// enforces it, so a future change that logs the body on an error path or buffers
// an upload to a temp file would otherwise ship silently.
//
// These tests drive real requests through s.routes() backed by a stub
// classifier (never a real *model.Model), so no libonnxruntime.so is needed at
// runtime. They are complementary to the container smoke test (task 035), which
// asserts the same property one level up by booting the image under
// `--read-only` and proving it never needs a writable filesystem. The two are
// deliberately redundant: this file catches an in-process leak at unit speed;
// the smoke test catches anything a hardcoded absolute path would slip past the
// TMPDIR redirect below.

// newPrivacyServer builds a Server whose logger writes to buf and whose classify
// seam is svc, so a test can inspect everything the server logged. It constructs
// the struct directly rather than calling New: New requires a concrete
// *classify.Service, but some cases here need a fake classifyService (to drive
// the 429/503 error handlers without a semaphore), and injecting a buffer logger
// is not part of New's signature. This mirrors newClassifyServer in
// classify_handler_test.go — the established pattern for api-package unit tests.
func newPrivacyServer(buf *bytes.Buffer, svc classifyService, maxBodyMB int) *Server {
	return &Server{
		version:   "vtest",
		token:     e2eToken, // reuse the e2e suite's bearer token
		state:     state.New(),
		model:     fakeModel{info: e2eModelInfo},
		classify:  svc,
		limits:    handlerLimits{MaxBodyMB: maxBodyMB, RequestTimeout: 2 * time.Second},
		startedAt: time.Now(),
		log:       slog.New(slog.NewJSONHandler(buf, nil)),
	}
	// ready is left false on purpose: /v1/classify does not gate on it (only
	// /healthz does), so the classify surface is fully exercisable without it.
}

// realStubService wires a real classify.Service over a stub classifier, so the
// genuine imaging.Prepare decode path runs (that is what produces the real
// 415/422 errors) while no ONNX Runtime is linked. clfErr, when set, is returned
// by the stub's Classify after a successful decode.
func realStubService(scores model.Scores, clfErr error) *classify.Service {
	stub := &stubClassifier{scores: scores, err: clfErr}
	return classify.New(stub, e2eSpec, e2ePolicy, 4, e2eMaxPixels, time.Second)
}

// privacyMarker is a byte string unlikely to occur by chance in encoder output,
// log framing, or JSON. Every request body below embeds it; the assertion is
// that it never reaches the log buffer.
var privacyMarker = []byte("MARKER_7F3A9C2E")

// validPNGWithMarker returns a decodable PNG with the marker appended after the
// IEND chunk. The stdlib PNG decoder stops at IEND, so the trailing marker is
// ignored by decode yet is genuinely present in the request body the handler
// reads — proving the success path does not copy it into the log.
func validPNGWithMarker(t *testing.T, marker []byte) []byte {
	t.Helper()
	return append(append([]byte{}, testPNG(t)...), marker...)
}

// truncatedPNGWithMarker returns a header-only PNG (DecodeConfig succeeds) with
// the marker appended where the pixel chunks should be, so image.Decode fails
// with a non-ErrFormat error -> imaging.ErrCorrupt -> 422. The marker is in the
// body the handler reads.
func truncatedPNGWithMarker(t *testing.T, marker []byte) []byte {
	t.Helper()
	return append(append([]byte{}, corruptPNG(t)...), marker...)
}

// oversizeBodyWithMarker returns a body strictly larger than capBytes, leading
// with the marker so MaxBytesReader trips only after the marker is already in
// the bytes io.ReadAll buffered (and then discarded) -> 413.
func oversizeBodyWithMarker(marker []byte, capBytes int) []byte {
	body := make([]byte, 0, capBytes+len(marker)+1)
	body = append(body, marker...)
	return append(body, bytes.Repeat([]byte{0xff}, capBytes+1)...)
}

// TestNoImageBytesInLogs drives POST /v1/classify through the full mux
// (routes() -> observe -> auth -> handleClassify) for the success path and every
// error path, and asserts the recognizable image marker never appears in the
// captured slog output. Error handlers are the most likely place to accidentally
// dump the body, so each status code (400/401/413/415/422/429/503) is covered.
//
// The marker is chosen to survive each path: raw marker bytes for the 415 case,
// the marker embedded in an otherwise-valid image for 200/401/422, and the
// marker leading an oversize body for 413. The 429/503 handlers are driven by a
// fake classifyService returning the sentinel (the real semaphore 429 is already
// exercised end-to-end by TestE2EClassifyBusy); what matters here is that the
// writeErr branch for each code does not log the body it was handed.
func TestNoImageBytesInLogs(t *testing.T) {
	const capMB = 1
	capBytes := capMB << 20

	cases := []struct {
		name string
		body []byte
		svc  classifyService
		auth bool
		want int
	}{
		{"ok", validPNGWithMarker(t, privacyMarker), realStubService(model.Scores{"safe": 1}, nil), true, http.StatusOK},
		{"empty", nil, &fakeClassify{}, true, http.StatusBadRequest},
		{"badtoken", validPNGWithMarker(t, privacyMarker), &fakeClassify{}, false, http.StatusUnauthorized},
		{"toobig", oversizeBodyWithMarker(privacyMarker, capBytes), &fakeClassify{}, true, http.StatusRequestEntityTooLarge},
		{"badformat", append([]byte{}, privacyMarker...), realStubService(nil, nil), true, http.StatusUnsupportedMediaType},
		{"corrupt", truncatedPNGWithMarker(t, privacyMarker), realStubService(nil, nil), true, http.StatusUnprocessableEntity},
		{"busy", validPNGWithMarker(t, privacyMarker), &fakeClassify{err: classify.ErrQueueTimeout}, true, http.StatusTooManyRequests},
		{"unavailable", validPNGWithMarker(t, privacyMarker), &fakeClassify{err: classify.ErrModelUnavailable}, true, http.StatusServiceUnavailable},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			s := newPrivacyServer(&buf, tc.svc, capMB)

			req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader(tc.body))
			req.Header.Set("Content-Type", "image/png")
			if tc.auth {
				req.Header.Set("Authorization", "Bearer "+e2eToken)
			}
			rr := httptest.NewRecorder()
			s.routes().ServeHTTP(rr, req)

			if rr.Code != tc.want {
				t.Fatalf("status = %d, want %d (body=%s)", rr.Code, tc.want, rr.Body)
			}
			// The access-log line (observe middleware) must have been emitted, so
			// the buffer is non-empty and the assertion is meaningful.
			if buf.Len() == 0 {
				t.Fatalf("no log output captured; the marker assertion would be vacuous")
			}
			if bytes.Contains(buf.Bytes(), privacyMarker) {
				t.Fatalf("image bytes leaked into logs on the %s path:\n%s", tc.name, buf.Bytes())
			}
		})
	}
}

// assertDirEmpty fails if dir contains any entry.
func assertDirEmpty(t *testing.T, dir string) {
	t.Helper()
	ents, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read dir %s: %v", dir, err)
	}
	if len(ents) != 0 {
		t.Fatalf("%s is not empty, want no files written: %v", dir, ents)
	}
}

// TestNoDiskWrites pins both the process working directory and TMPDIR to fresh
// empty dirs, fires a mix of raw and multipart requests across the success and
// error paths, and asserts both dirs stay empty — catching a handler that writes
// a relative-path file (lands in cwd) or an os.CreateTemp / multipart spill
// (lands in TMPDIR).
//
// Limits (spec §8 / task 035 cross-reference): t.Setenv("TMPDIR", …) only governs
// code that resolves temp dirs via os.TempDir()/os.CreateTemp — a write to a
// hardcoded absolute path such as /var/tmp would slip past it. The container
// smoke test (task 035) closes that gap at the --read-only level, where ANY
// write fails regardless of path. The two tests are complementary; keep both.
func TestNoDiskWrites(t *testing.T) {
	orig, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	cwd := t.TempDir()
	if err := os.Chdir(cwd); err != nil {
		t.Fatal(err)
	}
	// Restore cwd before t.TempDir's own cleanup removes the directory.
	defer func() { _ = os.Chdir(orig) }()

	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)

	const capMB = 2
	s := newPrivacyServer(&bytes.Buffer{}, realStubService(model.Scores{"safe": 1}, nil), capMB)

	// A mix of transports and outcomes: raw success, multipart success, plus the
	// undecodable (415), oversize (413) and empty (400) error paths. Each request
	// is built fresh (a new bytes.Reader over the stored bytes) every round, so
	// nothing depends on a rewindable body — a leak that only triggers under
	// repetition still surfaces.
	rawImg := testPNG(t)
	mpBody, mpType := multipartImage(t, "image", rawImg)
	oversize := bytes.Repeat([]byte{0xff}, (capMB<<20)+1)
	for round := 0; round < 4; round++ {
		s.routes().ServeHTTP(httptest.NewRecorder(), rawReq(rawImg))
		s.routes().ServeHTTP(httptest.NewRecorder(), multipartReq(mpBody, mpType))
		s.routes().ServeHTTP(httptest.NewRecorder(), rawReq([]byte("not an image at all")))
		s.routes().ServeHTTP(httptest.NewRecorder(), rawReq(oversize))
		s.routes().ServeHTTP(httptest.NewRecorder(), rawReq(nil))
	}

	assertDirEmpty(t, cwd)
	assertDirEmpty(t, tmp)
}

// TestMultipartNoSpill uploads a multipart image just under max_body and asserts
// no multipart temp file is left behind. r.ParseMultipartForm(maxMemory) writes
// parts larger than maxMemory to os.CreateTemp files named "multipart-*"; the
// handler passes maxMemory == max_body (classify_handler.go: ParseMultipartForm
// uses the same maxBytes MaxBytesReader enforces), so an allowed-size upload can
// never exceed maxMemory and therefore never spills. The handler also defers
// r.MultipartForm.RemoveAll(), the cleanup that would delete any spill from a
// future larger-limit regression. This test proves the no-spill property today;
// the RemoveAll defer is the belt-and-braces backstop documented in
// classify_handler.go.
func TestMultipartNoSpill(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)

	const capMB = 2
	s := newPrivacyServer(&bytes.Buffer{}, realStubService(model.Scores{"safe": 1}, nil), capMB)

	// A valid image padded (past IEND, so it still decodes) to just under the
	// body cap — a genuinely large file part that exercises the spill threshold.
	body, ctype := multipartImage(t, "image", nearCapImage(t, (capMB<<20)-4096))
	rr := httptest.NewRecorder()
	s.routes().ServeHTTP(rr, multipartReq(body, ctype))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}

	ents, err := os.ReadDir(tmp)
	if err != nil {
		t.Fatalf("read TMPDIR: %v", err)
	}
	for _, e := range ents {
		if strings.HasPrefix(e.Name(), "multipart-") {
			t.Fatalf("multipart upload spilled to disk: %s", e.Name())
		}
	}
	if len(ents) != 0 {
		t.Fatalf("TMPDIR not empty after multipart upload: %v", ents)
	}
}

// --- request builders shared by the disk-write tests ---

// rawReq builds an authenticated raw-body POST /v1/classify request.
func rawReq(body []byte) *http.Request {
	req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "image/png")
	req.Header.Set("Authorization", "Bearer "+e2eToken)
	return req
}

// multipartReq builds an authenticated multipart POST /v1/classify request.
func multipartReq(body []byte, ctype string) *http.Request {
	req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader(body))
	req.Header.Set("Content-Type", ctype)
	req.Header.Set("Authorization", "Bearer "+e2eToken)
	return req
}

// multipartImage encodes fileBytes as a single "image" file field and returns
// the body and its Content-Type.
func multipartImage(t *testing.T, field string, fileBytes []byte) (body []byte, contentType string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile(field, "upload.png")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := fw.Write(fileBytes); err != nil {
		t.Fatalf("write file part: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}
	return buf.Bytes(), mw.FormDataContentType()
}

// nearCapImage returns a decodable PNG padded past IEND to approximately size
// bytes, so the encoded file is large without exceeding the pixel cap (the pad
// is ignored by the decoder).
func nearCapImage(t *testing.T, size int) []byte {
	t.Helper()
	img := testPNG(t)
	if size <= len(img) {
		return img
	}
	return append(img, bytes.Repeat([]byte{0x00}, size-len(img))...)
}
