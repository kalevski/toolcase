package fakes

import (
	"fmt"
	"strings"
	"time"
)

var statefulBoxes = []struct{ id, name, role string }{
	{"mb-inbox", "Inbox", "inbox"},
	{"mb-drafts", "Drafts", "drafts"},
	{"mb-sent", "Sent", "sent"},
	{"mb-trash", "Trash", "trash"},
}

func boxOf(e Email) string {
	if e.Box == "" {
		return "mb-inbox"
	}
	return e.Box
}

func (e Email) received() string {
	if e.Created.IsZero() {
		return "2026-01-02T03:04:05Z"
	}
	return e.Created.UTC().Format(time.RFC3339)
}

func (w *World) find(id string) int {
	for i, e := range w.Emails {
		if e.ID == id {
			return i
		}
	}
	return -1
}

func (w *World) keywordsOf(e Email) map[string]bool {
	k := map[string]bool{}
	if !e.Unread {
		k["$seen"] = true
	}
	if e.Flagged {
		k["$flagged"] = true
	}
	if boxOf(e) == "mb-drafts" {
		k["$draft"] = true
	}
	return k
}

func (w *World) patch(e *Email, patch map[string]any) {
	for key, val := range patch {
		switch {
		case key == "keywords":
			m, _ := val.(map[string]any)
			_, seen := m["$seen"]
			_, flagged := m["$flagged"]
			e.Unread, e.Flagged = !seen, flagged
		case key == "keywords/$seen":
			e.Unread = val == nil || val == false
		case key == "keywords/$flagged":
			e.Flagged = val != nil && val != false
		case key == "mailboxIds":
			if m, ok := val.(map[string]any); ok {
				for id := range m {
					e.Box = id
				}
			}
		case strings.HasPrefix(key, "mailboxIds/"):
			if val != nil && val != false {
				e.Box = strings.TrimPrefix(key, "mailboxIds/")
			}
		}
	}
}

func addrs(v any) string {
	list, _ := v.([]any)
	out := []string{}
	for _, x := range list {
		if m, ok := x.(map[string]any); ok {
			if em, _ := m["email"].(string); em != "" {
				out = append(out, em)
			}
		}
	}
	return strings.Join(out, ", ")
}

// statefulMethod answers the methods whose result depends on what the user has done; everything else falls through
// to the static answers.
func (w *World) statefulMethod(name, acc string, args map[string]any) (any, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	switch name {
	case "Mailbox/get":
		list := []any{}
		for i, b := range statefulBoxes {
			total, unread := 0, 0
			for _, e := range w.Emails {
				if boxOf(e) == b.id {
					total++
					if e.Unread {
						unread++
					}
				}
			}
			list = append(list, map[string]any{"id": b.id, "name": b.name, "role": b.role, "totalEmails": total, "unreadEmails": unread, "sortOrder": i + 1})
		}
		for i, f := range w.folders {
			total, unread := 0, 0
			for _, e := range w.Emails {
				if boxOf(e) == f.id {
					total++
					if e.Unread {
						unread++
					}
				}
			}
			var parent any
			if f.parent != "" {
				parent = f.parent
			}
			list = append(list, map[string]any{"id": f.id, "name": f.name, "role": nil, "parentId": parent, "totalEmails": total, "unreadEmails": unread, "sortOrder": 10 + i,
				"myRights": map[string]bool{"mayRename": true, "mayDelete": true, "mayCreateChild": true}})
		}
		return map[string]any{"accountId": acc, "state": fmt.Sprintf("m%d", w.nextID), "notFound": []string{}, "list": list}, true
	case "Email/query":
		filter, _ := args["filter"].(map[string]any)
		inBox, _ := filter["inMailbox"].(string)
		text, _ := filter["text"].(string)
		ids := []string{}
		for i := len(w.Emails) - 1; i >= 0; i-- {
			e := w.Emails[i]
			if inBox != "" && boxOf(e) != inBox {
				continue
			}
			if text != "" && !strings.Contains(strings.ToLower(e.Subject+" "+e.From+" "+e.Text), strings.ToLower(text)) {
				continue
			}
			if kw, _ := filter["hasKeyword"].(string); kw != "" && !w.keywordsOf(e)[kw] {
				continue
			}
			if kw, _ := filter["notKeyword"].(string); kw != "" && w.keywordsOf(e)[kw] {
				continue
			}
			ids = append(ids, e.ID)
		}
		return map[string]any{"accountId": acc, "queryState": fmt.Sprintf("q%d", w.nextID), "canCalculateChanges": false, "position": 0, "ids": ids, "total": len(ids)}, true
	case "Email/get":
		want, _ := args["ids"].([]any)
		if _, ref := args["#ids"]; ref {
			for _, e := range w.Emails {
				want = append(want, e.ID)
			}
		}
		list := []any{}
		notFound := []string{}
		for _, x := range want {
			id, _ := x.(string)
			i := w.find(id)
			if i < 0 {
				notFound = append(notFound, id)
				continue
			}
			e := w.Emails[i]
			m := map[string]any{"id": e.ID, "threadId": "t-" + e.ID, "subject": e.Subject,
				"from": []any{map[string]any{"email": e.From}}, "receivedAt": e.received(),
				"keywords": w.keywordsOf(e), "mailboxIds": map[string]bool{boxOf(e): true}, "preview": e.Text}
			if e.To != "" {
				to := []any{}
				for _, a := range strings.Split(e.To, ", ") {
					to = append(to, map[string]any{"email": a})
				}
				m["to"] = to
			}
			parts := []any{map[string]any{"partId": "1", "type": "text/plain", "blobId": "b1"}}
			body := map[string]any{"1": map[string]any{"value": e.Text}}
			html := parts
			if e.HTML != "" {
				html = []any{map[string]any{"partId": "2", "type": "text/html", "blobId": "b2"}}
				body["2"] = map[string]any{"value": e.HTML}
			}
			var subs []any
			for cid, b := range e.CID {
				subs = append(subs, map[string]any{"blobId": blobID(cid), "type": "image/png", "cid": cid, "size": len(b)})
			}
			m["textBody"], m["htmlBody"], m["bodyValues"] = parts, html, body
			m["bodyStructure"] = map[string]any{"type": "multipart/related", "subParts": subs}
			list = append(list, m)
		}
		return map[string]any{"accountId": acc, "state": fmt.Sprintf("e%d", w.nextID), "list": list, "notFound": notFound}, true
	case "Email/set":
		w.lastCreated = map[string]string{}
		updated := map[string]any{}
		created := map[string]any{}
		if upd, ok := args["update"].(map[string]any); ok {
			for id, p := range upd {
				if i := w.find(id); i >= 0 {
					patch, _ := p.(map[string]any)
					w.patch(&w.Emails[i], patch)
					updated[id] = nil
				}
			}
		}
		if cr, ok := args["create"].(map[string]any); ok {
			for cid, obj := range cr {
				o, _ := obj.(map[string]any)
				w.nextID++
				id := fmt.Sprintf("n%d", w.nextID)
				e := Email{ID: id, Subject: fmt.Sprint(o["subject"]), From: "ann@example.test", To: addrs(o["to"]), Created: time.Now(), Box: "mb-drafts"}
				if o["subject"] == nil {
					e.Subject = ""
				}
				if bv, ok := o["bodyValues"].(map[string]any); ok {
					for _, v := range bv {
						if m, ok := v.(map[string]any); ok {
							e.Text, _ = m["value"].(string)
						}
					}
				}
				if mb, ok := o["mailboxIds"].(map[string]any); ok {
					for k := range mb {
						e.Box = k
					}
				}
				w.Emails = append(w.Emails, e)
				w.lastCreated[cid] = id
				created[cid] = map[string]any{"id": id}
			}
		}
		if del, ok := args["destroy"].([]any); ok {
			for _, x := range del {
				id, _ := x.(string)
				if i := w.find(id); i >= 0 {
					w.Emails = append(w.Emails[:i], w.Emails[i+1:]...)
				}
			}
		}
		w.nextID++
		return map[string]any{"accountId": acc, "oldState": "e0", "newState": fmt.Sprintf("e%d", w.nextID), "updated": updated, "created": created}, true
	case "Identity/get":
		return map[string]any{"accountId": acc, "state": "i1", "notFound": []string{}, "list": []any{
			map[string]any{"id": "id1", "name": "Ann", "email": "ann@example.test", "replyTo": nil, "bcc": nil, "textSignature": "", "htmlSignature": "", "mayDelete": false},
		}}, true
	case "Mailbox/set":
		created := map[string]any{}
		updated := map[string]any{}
		destroyed := []string{}
		if cr, ok := args["create"].(map[string]any); ok {
			for cid, obj := range cr {
				o, _ := obj.(map[string]any)
				w.nextID++
				id := fmt.Sprintf("mb-u%d", w.nextID)
				parent, _ := o["parentId"].(string)
				w.folders = append(w.folders, folder{id: id, name: fmt.Sprint(o["name"]), parent: parent})
				created[cid] = map[string]any{"id": id}
			}
		}
		if upd, ok := args["update"].(map[string]any); ok {
			for id, p := range upd {
				patch, _ := p.(map[string]any)
				for i := range w.folders {
					if w.folders[i].id == id {
						if n, ok := patch["name"].(string); ok {
							w.folders[i].name = n
						}
						if _, ok := patch["parentId"]; ok {
							w.folders[i].parent, _ = patch["parentId"].(string)
						}
						updated[id] = nil
					}
				}
			}
		}
		if del, ok := args["destroy"].([]any); ok {
			for _, x := range del {
				id, _ := x.(string)
				for i := range w.folders {
					if w.folders[i].id == id {
						w.folders = append(w.folders[:i], w.folders[i+1:]...)
						destroyed = append(destroyed, id)
						break
					}
				}
			}
		}
		w.nextID++
		return map[string]any{"accountId": acc, "oldState": "m0", "newState": fmt.Sprintf("m%d", w.nextID), "created": created, "updated": updated, "destroyed": destroyed}, true
	case "EmailSubmission/set":
		out := map[string]any{"accountId": acc, "oldState": "s0", "newState": "s1", "created": map[string]any{}}
		cr, _ := args["create"].(map[string]any)
		for cid, obj := range cr {
			o, _ := obj.(map[string]any)
			ref, _ := o["emailId"].(string)
			id := w.lastCreated[strings.TrimPrefix(ref, "#")]
			if id == "" {
				id = ref
			}
			if i := w.find(id); i >= 0 {
				w.LastForwarded = w.Emails[i].To
				if upd, ok := args["onSuccessUpdateEmail"].(map[string]any); ok {
					if p, ok := upd["#"+cid].(map[string]any); ok {
						w.patch(&w.Emails[i], p)
					}
				}
				out["created"].(map[string]any)[cid] = map[string]any{"id": "sub-" + id}
			}
		}
		return out, true
	}
	return nil, false
}
