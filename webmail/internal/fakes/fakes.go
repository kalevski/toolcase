// Package fakes is a fake JMAP server over one in-memory world, for tests and
// the local smoke run. It implements just enough of RFC 8620/8621 for the
// gateway paths; it is NOT Stalwart and proves nothing about Stalwart's
// behaviour.
package fakes

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// World is the shared state.
type World struct {
	mu sync.Mutex

	// JMAPPublic is the (unreachable) public name the JMAP session document
	// advertises; the gateway must re-root it.
	JMAPPublic string

	Users map[string]string // address -> password

	Emails []Email
	// Stateful makes the fake JMAP server remember keywords, folders, drafts and sends (see stateful.go).
	Stateful    bool
	lastCreated map[string]string
	nextID      int
	folders     []folder
	// Counters tests assert on.
	JMAPRequests  int
	SessionDocs   int
	Uploads       int
	LastForwarded string
}

type cred struct{ address string }

type folder struct{ id, name, parent string }

// Email is a seeded message.
type Email struct {
	ID, Subject, From string
	HTML, Text        string
	CID               map[string][]byte // cid -> png bytes
	Unread            bool
	Box               string // stateful mode: the mailbox id; empty means the inbox
	Flagged           bool
	To                string
	Created           time.Time
}

// NewWorld seeds one mailbox, ann@example.test / correct-horse.
func NewWorld() *World {
	png := []byte("\x89PNG\r\n\x1a\nfake")
	return &World{
		Users: map[string]string{"ann@example.test": "correct-horse"},
		Emails: []Email{
			{ID: "e1", Subject: "Welcome", From: "boss@example.test", Unread: true,
				HTML: `<p>Hello <b>Ann</b></p><img src="cid:logo@x"><img src="https://tracker.example/p.gif"><script>alert(1)</script><a href="javascript:alert(1)">x</a>`,
				Text: "Hello Ann", CID: map[string][]byte{"logo@x": png}},
			{ID: "e2", Subject: "Plain note", From: "bob@example.test", Text: "Just text https://example.org/x", Unread: true},
			{ID: "e3", Subject: "Old", From: "carol@example.test", Text: "Old mail"},
		},
	}
}

func randHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// SetPassword changes a mailbox password, as an admin or a password change
// would: every client holding the old one is refused from then on.
func (w *World) SetPassword(address, password string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Users[address] = password
}

func writeJSON(rw http.ResponseWriter, status int, v any) {
	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(status)
	json.NewEncoder(rw).Encode(v)
}

// JMAPHandler serves the fake mail server.
func (w *World) JMAPHandler() http.Handler {
	mux := http.NewServeMux()
	auth := func(h func(rw http.ResponseWriter, r *http.Request, c cred)) http.HandlerFunc {
		return func(rw http.ResponseWriter, r *http.Request) {
			user, pass, ok := r.BasicAuth()
			w.mu.Lock()
			want, found := w.Users[strings.ToLower(user)]
			w.LastForwarded = r.Header.Get("X-Forwarded-For")
			w.mu.Unlock()
			if !ok || !found || want != pass {
				rw.Header().Set("WWW-Authenticate", `Basic realm="jmap"`)
				rw.WriteHeader(401)
				return
			}
			h(rw, r, cred{address: strings.ToLower(user)})
		}
	}
	mux.HandleFunc("POST /api/account/auth", auth(func(rw http.ResponseWriter, r *http.Request, c cred) {
		var ops []struct{ Type, Password string }
		json.NewDecoder(r.Body).Decode(&ops)
		if len(ops) != 1 || ops[0].Type != "changePassword" {
			rw.WriteHeader(400)
			return
		}
		if len(ops[0].Password) < 8 {
			writeJSON(rw, 422, map[string]string{"message": "Password must be at least 8 characters."})
			return
		}
		w.mu.Lock()
		w.Users[c.address] = ops[0].Password
		w.mu.Unlock()
		rw.WriteHeader(204)
	}))
	mux.HandleFunc("GET /.well-known/jmap", auth(func(rw http.ResponseWriter, r *http.Request, c cred) {
		w.mu.Lock()
		w.SessionDocs++
		w.mu.Unlock()
		pub := w.JMAPPublic
		writeJSON(rw, 200, map[string]any{
			"capabilities": map[string]any{
				"urn:ietf:params:jmap:core": map[string]any{"maxCallsInRequest": 16, "maxSizeUpload": 50000000},
				"urn:ietf:params:jmap:mail": map[string]any{}, "urn:ietf:params:jmap:submission": map[string]any{},
				"urn:ietf:params:jmap:vacationresponse": map[string]any{}, "urn:ietf:params:jmap:quota": map[string]any{},
				"urn:com:stalwart:jmap": map[string]any{},
			},
			"accounts": map[string]any{
				"acc1":    map[string]any{"name": c.address, "isPersonal": true, "isReadOnly": false, "accountCapabilities": map[string]any{"urn:ietf:params:jmap:mail": map[string]any{}}},
				"shared1": map[string]any{"name": "shared", "isPersonal": false, "accountCapabilities": map[string]any{"urn:ietf:params:jmap:mail": map[string]any{}}},
			},
			"primaryAccounts": map[string]string{"urn:ietf:params:jmap:mail": "acc1", "urn:ietf:params:jmap:submission": "acc1"},
			"username":        c.address,
			"apiUrl":          pub + "/jmap/",
			"downloadUrl":     pub + "/jmap/download/{accountId}/{blobId}/{name}?accept={type}",
			"uploadUrl":       pub + "/jmap/upload/{accountId}/",
			"eventSourceUrl":  pub + "/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}",
			"state":           "s1",
		})
	}))
	mux.HandleFunc("POST /jmap/", auth(func(rw http.ResponseWriter, r *http.Request, c cred) {
		w.mu.Lock()
		w.JMAPRequests++
		w.mu.Unlock()
		var req struct {
			MethodCalls [][]json.RawMessage `json:"methodCalls"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		var out []any
		for _, mc := range req.MethodCalls {
			var name string
			var args map[string]any
			json.Unmarshal(mc[0], &name)
			json.Unmarshal(mc[1], &args)
			var id string
			json.Unmarshal(mc[2], &id)
			out = append(out, []any{name, w.method(name, args), id})
		}
		writeJSON(rw, 200, map[string]any{"methodResponses": out, "sessionState": "s1"})
	}))
	mux.HandleFunc("GET /jmap/download/{acc}/{blob}/{name}", auth(func(rw http.ResponseWriter, r *http.Request, c cred) {
		for _, e := range w.Emails {
			for cid, b := range e.CID {
				if blobID(cid) == r.PathValue("blob") {
					rw.Header().Set("Content-Type", "image/png")
					rw.Write(b)
					return
				}
			}
		}
		if r.PathValue("blob") == "blob-att" {
			rw.Write([]byte("attachment-bytes"))
			return
		}
		rw.WriteHeader(404)
	}))
	mux.HandleFunc("POST /jmap/upload/{acc}/", auth(func(rw http.ResponseWriter, r *http.Request, c cred) {
		n, _ := io.Copy(io.Discard, r.Body)
		w.mu.Lock()
		w.Uploads++
		w.mu.Unlock()
		writeJSON(rw, 201, map[string]any{"accountId": r.PathValue("acc"), "blobId": "up-" + randHex(4), "type": r.Header.Get("Content-Type"), "size": n})
	}))
	mux.HandleFunc("GET /jmap/eventsource/", auth(func(rw http.ResponseWriter, r *http.Request, c cred) {
		rw.Header().Set("Content-Type", "text/event-stream")
		rw.WriteHeader(200)
		fmt.Fprint(rw, "event: state\ndata: {\"@type\":\"StateChange\",\"changed\":{\"acc1\":{\"Email\":\"s2\"}}}\n\n")
		rw.(http.Flusher).Flush()
		select {
		case <-r.Context().Done():
		case <-time.After(300 * time.Millisecond):
		}
	}))
	return mux
}

func (w *World) method(name string, args map[string]any) any {
	acc, _ := args["accountId"].(string)
	if w.Stateful {
		if res, ok := w.statefulMethod(name, acc, args); ok {
			return res
		}
	}
	switch name {
	case "Core/echo":
		return args
	case "Mailbox/get":
		return map[string]any{"accountId": acc, "state": "m1", "notFound": []string{}, "list": []any{
			map[string]any{"id": "mb-inbox", "name": "Inbox", "role": "inbox", "totalEmails": len(w.Emails), "unreadEmails": 2, "sortOrder": 1},
			map[string]any{"id": "mb-sent", "name": "Sent", "role": "sent", "totalEmails": 0, "unreadEmails": 0, "sortOrder": 3},
			map[string]any{"id": "mb-trash", "name": "Trash", "role": "trash", "totalEmails": 0, "unreadEmails": 0, "sortOrder": 6},
		}}
	case "Email/query":
		ids := []string{}
		for _, e := range w.Emails {
			ids = append(ids, e.ID)
		}
		return map[string]any{"accountId": acc, "queryState": "q1", "canCalculateChanges": false, "position": 0, "ids": ids, "total": len(ids)}
	case "Email/get":
		list := []any{}
		notFound := []string{}
		want, _ := args["ids"].([]any)
		if _, ref := args["#ids"]; ref {
			for _, e := range w.Emails {
				want = append(want, e.ID)
			}
		}
		for _, x := range want {
			id, _ := x.(string)
			found := false
			for _, e := range w.Emails {
				if e.ID != id {
					continue
				}
				found = true
				m := map[string]any{"id": e.ID, "threadId": "t-" + e.ID, "subject": e.Subject,
					"from": []any{map[string]any{"email": e.From}}, "receivedAt": "2026-01-02T03:04:05Z",
					"keywords": map[string]bool{}, "mailboxIds": map[string]bool{"mb-inbox": true}, "preview": e.Text}
				if !e.Unread {
					m["keywords"] = map[string]bool{"$seen": true}
				}
				parts := []any{map[string]any{"partId": "1", "type": "text/plain", "blobId": "b1"}}
				body := map[string]any{"1": map[string]any{"value": e.Text}}
				html := []any{}
				if e.HTML != "" {
					html = []any{map[string]any{"partId": "2", "type": "text/html", "blobId": "b2"}}
					body["2"] = map[string]any{"value": e.HTML}
				} else {
					html = parts
				}
				var subs []any
				for cid, b := range e.CID {
					subs = append(subs, map[string]any{"blobId": blobID(cid), "type": "image/png", "cid": cid, "size": len(b)})
				}
				m["textBody"], m["htmlBody"], m["bodyValues"] = parts, html, body
				m["bodyStructure"] = map[string]any{"type": "multipart/related", "subParts": subs}
				list = append(list, m)
			}
			if !found {
				notFound = append(notFound, id)
			}
		}
		return map[string]any{"accountId": acc, "state": "e1", "list": list, "notFound": notFound}
	case "Thread/get":
		want, _ := args["ids"].([]any)
		list := []any{}
		for _, e := range w.Emails {
			tid := "t-" + e.ID
			keep := len(want) == 0
			for _, x := range want {
				if s, _ := x.(string); s == tid {
					keep = true
				}
			}
			if keep {
				list = append(list, map[string]any{"id": tid, "emailIds": []string{e.ID}})
			}
		}
		return map[string]any{"accountId": acc, "state": "t1", "list": list, "notFound": []string{}}
	case "Email/set":
		return map[string]any{"accountId": acc, "oldState": "e1", "newState": "e2", "updated": map[string]any{}}
	case "Quota/get":
		return map[string]any{"accountId": acc, "state": "qq", "list": []any{map[string]any{"id": "q", "resourceType": "octets", "used": 1000, "hardLimit": 100000, "scope": "account", "name": "q"}}, "notFound": []string{}}
	}
	return map[string]any{"type": "unknownMethod"}
}

// B64 is a helper for tests building basic-auth headers.
func B64(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

func blobID(cid string) string { return "blob-" + strings.NewReplacer("@", "-", ".", "-").Replace(cid) }
