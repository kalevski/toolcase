package clusteradmin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/forward"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
)

// PeerAdminPath is the peer endpoint that runs an admin call another node has
// already authenticated (spec §8.5, §8.6).
const PeerAdminPath = cluster.PeerPrefix + "admin"

// RelayHeader marks an answer that is the admin API's own, as opposed to an
// error of the peer layer (a wrong cluster key, a node that is starting): the
// first is relayed to the admin client as it is, the second becomes a 503.
const RelayHeader = "X-Binvault-Relay"

// OpHeader carries the name of the admin operation a node ran for a relayed call,
// so that the node that received the call counts and logs it under that name.
const OpHeader = "X-Binvault-Admin-Op"

const (
	maxEnvelope = 2 << 20
	// bodyLimit bounds a relayed request body: admin bodies are at most 256 KiB.
	bodyLimit = admin.MaxBody
)

// envelope is the body of POST /_peer/v1/admin: the admin call as the receiving
// node saw it, minus the admin token, which never crosses the peer link (§8.6).
type envelope struct {
	Method string `json:"method"`
	// Path is the admin path after /_admin/v1, starting with a slash.
	Path string `json:"path"`
	// Query is the raw query string, without the question mark.
	Query string `json:"query,omitempty"`
	// Headers is the subset of request headers the admin handlers read.
	Headers map[string]string `json:"headers,omitempty"`
	Body    []byte            `json:"body,omitempty"`
	// RequestID is the id of the original request, so that one id traces both nodes.
	RequestID string `json:"request_id,omitempty"`
}

// relayedHeaders are the request headers an envelope may carry.
var relayedHeaders = []string{"Content-Type", "If-Match", "Accept"}

// reply is what a peer answered.
type reply struct {
	status int
	header http.Header
	body   []byte
	op     string // the admin operation that answered (OpHeader)
}

// callPeer sends an admin call to the node at url as a peer request and returns
// its answer. ok is false when the answer is not the admin API's own.
func (r *Router) callPeer(ctx context.Context, url string, env envelope, timeout time.Duration) (rep reply, ok bool, err error) {
	raw, err := json.Marshal(env)
	if err != nil {
		return rep, false, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url+PeerAdminPath, bytes.NewReader(raw))
	if err != nil {
		return rep, false, err
	}
	req.Header.Set("Content-Type", "application/json")
	r.Node.AuthRequest(req)
	if env.RequestID != "" {
		req.Header.Set(forward.HeaderRequestID, env.RequestID)
	}
	resp, err := r.Node.Client().Do(req)
	if err != nil {
		return rep, false, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return rep, false, err
	}
	rep = reply{status: resp.StatusCode, header: resp.Header, body: body, op: resp.Header.Get(OpHeader)}
	return rep, resp.Header.Get(RelayHeader) == "admin", nil
}

// ServePeerAdmin is the handler of POST /_peer/v1/admin (cluster.Mux.RegisterPeer):
// it runs the admin call of the envelope on this node, as if it had arrived on
// the admin listener with a valid token, and answers with the admin API's own
// status and body. The mux has checked the cluster key.
func (r *Router) ServePeerAdmin(w http.ResponseWriter, req *http.Request) {
	w.Header().Set(RelayHeader, "admin")
	if req.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		admin.WriteJSON(w, http.StatusMethodNotAllowed, errBody("method_not_allowed", ""))
		return
	}
	if !r.Ready() {
		admin.WriteJSON(w, http.StatusServiceUnavailable, errBody("unavailable", "this node is starting"))
		return
	}
	raw, err := io.ReadAll(io.LimitReader(req.Body, maxEnvelope+1))
	if err != nil || len(raw) > maxEnvelope {
		admin.WriteJSON(w, http.StatusBadRequest, errBody("invalid_request", "the admin envelope could not be read or is too large"))
		return
	}
	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		admin.WriteJSON(w, http.StatusBadRequest, errBody("invalid_request", "the admin envelope is not valid JSON"))
		return
	}
	if err := validEnvelope(&env); err != nil {
		admin.WriteJSON(w, http.StatusBadRequest, errBody("invalid_request", err.Error()))
		return
	}
	segs := splitPath(env.Path)
	// a call for a bucket is run only where the catalog says the bucket lives, so a
	// node with a stale view of the catalog cannot change a bucket it does not home
	if bucket := bucketOfCall(env.Method, segs, env.Body); bucket != "" {
		guard := r.mustHome
		if isBucketDelete(env.Method, segs) {
			guard = r.mustCatalogHome // what a delete may have to remove is the entry alone
		}
		if err := guard(bucket); err != nil {
			var ae *admin.APIError
			if errors.As(err, &ae) {
				admin.WriteJSON(w, ae.Status, errBody(ae.Code, ae.Detail))
				return
			}
			admin.WriteJSON(w, http.StatusInternalServerError, errBody("internal", err.Error()))
			return
		}
	}
	inner, err := http.NewRequestWithContext(req.Context(), env.Method, "http://peer/_admin/v1"+env.Path, bytes.NewReader(env.Body))
	if err != nil {
		admin.WriteJSON(w, http.StatusBadRequest, errBody("invalid_request", "the admin envelope names no valid request"))
		return
	}
	inner.URL.RawQuery = env.Query
	inner.RequestURI = "/_admin/v1" + env.Path
	if env.Query != "" {
		inner.RequestURI += "?" + env.Query
	}
	for k, v := range env.Headers {
		inner.Header.Set(k, v)
	}
	if len(env.Body) > 0 {
		inner.ContentLength = int64(len(env.Body))
	}
	r.Admin.ServePeer(&opWriter{ResponseWriter: w, info: httpx.From(req.Context())}, inner, env.Path, env.Query)
}

// opWriter adds the name of the operation the handlers settled on to the answer,
// just before the status is written.
type opWriter struct {
	http.ResponseWriter
	info  *httpx.Info
	wrote bool
}

func (o *opWriter) WriteHeader(code int) {
	if !o.wrote {
		o.wrote = true
		if o.info != nil && o.info.Op != "" {
			o.Header().Set(OpHeader, o.info.Op)
		}
	}
	o.ResponseWriter.WriteHeader(code)
}

func (o *opWriter) Write(p []byte) (int, error) {
	if !o.wrote {
		o.WriteHeader(http.StatusOK)
	}
	return o.ResponseWriter.Write(p)
}

func errBody(code, detail string) map[string]string {
	b := map[string]string{"error": code}
	if detail != "" {
		b["detail"] = detail
	}
	return b
}

var peerMethods = map[string]bool{
	http.MethodGet: true, http.MethodPost: true, http.MethodPut: true, http.MethodPatch: true, http.MethodDelete: true,
}

func validEnvelope(e *envelope) error {
	switch {
	case !peerMethods[e.Method]:
		return fmt.Errorf("method %q is not an admin method", e.Method)
	case !strings.HasPrefix(e.Path, "/") || len(e.Path) > 2048 || strings.ContainsAny(e.Path, "?#") || strings.Contains(e.Path, "//"):
		return errors.New("the admin path is not valid")
	case len(e.Query) > 8192 || strings.ContainsAny(e.Query, " \r\n#"):
		return errors.New("the admin query is not valid")
	case len(e.Body) > bodyLimit+1:
		return errors.New("the admin body is too large")
	}
	for k := range e.Headers {
		ok := false
		for _, h := range relayedHeaders {
			if strings.EqualFold(k, h) {
				ok = true
			}
		}
		if !ok {
			return fmt.Errorf("header %q is not relayed", k)
		}
	}
	return nil
}

func splitPath(path string) []string {
	rest := strings.Trim(path, "/")
	if rest == "" {
		return nil
	}
	return strings.Split(rest, "/")
}
