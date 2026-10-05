package mover

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The move protocol, on the peer listener (spec §8.8). Every call carries the
// cluster key (the mux has checked it) and is addressed to a move id:
//
//	POST /_peer/v1/moves/{id}/prepare            JSON  open an incoming move
//	PUT  /_peer/v1/moves/{id}/blob/{blob}        raw   one blob (size header, sha256 trailer)
//	PUT  /_peer/v1/moves/{id}/part/{upload}/{part}  raw   one part file of an open upload
//	POST /_peer/v1/moves/{id}/rows               raw   the bucket's rows (meta.ExportBucket's stream)
//	POST /_peer/v1/moves/{id}/activate           JSON  the target's one decision
//	POST /_peer/v1/moves/{id}/discard            JSON  drop the partial copy
//	GET  /_peer/v1/moves/{id}                    JSON  the target's record of the move
const PathPrefix = cluster.PeerPrefix + "moves/"

// Headers of a blob or part upload. The body is the raw bytes, sent chunked: its
// SHA-256 follows as the trailer, so that the sender hashes while it streams.
const (
	HeaderSize      = "X-Binvault-Size"       // stored size in bytes
	HeaderPlainSize = "X-Binvault-Plain-Size" // size of the plaintext (blobs)
	HeaderSSE       = "X-Binvault-Sse"        // "1" for an encrypted blob
	TrailerDigest   = "X-Binvault-Sha256"     // hex SHA-256 of the body
)

// Results of the control calls (reply.Result).
const (
	resultOK      = "ok"      // done
	resultExists  = "exists"  // a blob or part already there with the right size
	resultBusy    = "busy"    // the target cannot take the move now (another move, a pipeline still on its way): ask again later
	resultRefused = "refused" // the target will not take this move (or this call); Detail says why
)

// The target's answer to activate. It is deliberately not like anything a proxy
// would say: HTTP 200, application/json, the move id echoed, and one of two words.
const (
	activateOK      = "OK"
	activateRefused = "REFUSED"
)

// detailAnotherMove is the detail of the `busy` answer of a target that takes part in
// another move.
const detailAnotherMove = "this node takes part in another move"

type prepareReq struct {
	Bucket     string `json:"bucket"`
	Generation string `json:"generation"`
	// Epoch is the epoch the move installs: the bucket's epoch + 1.
	Epoch int64 `json:"epoch"`
	// From is the node id of the source.
	From   string   `json:"from"`
	Bytes  int64    `json:"bytes"`
	KeyIDs []string `json:"key_ids"`
	// FreezeTimeoutMS is the source's BINVAULT_MOVE_FREEZE_TIMEOUT, so that the
	// target knows how long the source may be silent.
	FreezeTimeoutMS int64 `json:"freeze_timeout_ms"`
}

// reply is the body of the target's answers to everything but activate.
type reply struct {
	Result string      `json:"result"`
	Detail string      `json:"detail,omitempty"`
	Counts meta.Counts `json:"counts,omitempty"`
	State  string      `json:"state,omitempty"`
}

type activateReply struct {
	Move   string `json:"move"`
	Result string `json:"result"`
	Reason string `json:"reason,omitempty"`
}

// callResult is what a control call came back with. A call that got no HTTP
// answer at all returns an error instead.
type callResult struct {
	Status int
	// ContentJSON says the answer declared itself application/json (as opposed to an
	// error page of something in between); JSON that it also parsed as a reply.
	ContentJSON bool
	JSON        bool
	Reply       reply
	Body        []byte
}

func (c callResult) detail() string {
	if c.Reply.Detail != "" {
		return c.Reply.Detail
	}
	s := strings.TrimSpace(string(c.Body))
	if len(s) > 200 {
		s = s[:200] + "…"
	}
	return fmt.Sprintf("HTTP %d %s", c.Status, s)
}

// control calls a small JSON endpoint of the peer's move protocol.
func (m *Mover) control(ctx context.Context, base, id, verb, method string, body any, timeout time.Duration) (callResult, error) {
	var rd io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return callResult{}, err
		}
		rd = bytes.NewReader(raw)
	}
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	url := base + PathPrefix + id
	if verb != "" {
		url += "/" + verb
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rd)
	if err != nil {
		return callResult{}, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	m.o.Node.AuthRequest(req)
	resp, err := m.o.Node.Client().Do(req)
	if err != nil {
		return callResult{}, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return callResult{}, err
	}
	return decodeCall(resp, raw), nil
}

func decodeCall(resp *http.Response, raw []byte) callResult {
	res := callResult{Status: resp.StatusCode, Body: raw}
	if mt, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type")); err == nil && mt == "application/json" {
		res.ContentJSON = true
		if json.Unmarshal(raw, &res.Reply) == nil {
			res.JSON = true
		}
	}
	return res
}

// writeReply answers a protocol call.
func writeReply(w http.ResponseWriter, status int, r reply) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(r)
}

func refused(w http.ResponseWriter, format string, a ...any) {
	writeReply(w, http.StatusConflict, reply{Result: resultRefused, Detail: fmt.Sprintf(format, a...)})
}

// decodeJSON reads a small JSON request body, strictly.
func decodeJSON(r *http.Request, dst any, limit int64) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, limit+1))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if dec.More() {
		return fmt.Errorf("trailing data")
	}
	return nil
}

func jsonEncode(w io.Writer, v any) error { return json.NewEncoder(w).Encode(v) }
