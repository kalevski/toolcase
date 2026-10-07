package gateway

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/sanitize"
	"github.com/kalevski/toolcase/webmail/internal/session"
)

const (
	maxBodyValueBytes = 2 << 20 // per body part fetched from the server
	maxInlineImage    = 2 << 20 // one cid image
	maxInlineTotal    = 8 << 20 // all cid images of a message
)

// bodyPart is the subset of an RFC 8621 EmailBodyPart the gateway reads.
type bodyPart struct {
	PartID   string     `json:"partId"`
	BlobID   string     `json:"blobId"`
	Size     int64      `json:"size"`
	Type     string     `json:"type"`
	CID      string     `json:"cid"`
	SubParts []bodyPart `json:"subParts"`
}

type emailGetResponse struct {
	MethodResponses [][]json.RawMessage `json:"methodResponses"`
}

type emailGetResult struct {
	List []struct {
		BodyStructure bodyPart             `json:"bodyStructure"`
		TextBody      []bodyPart           `json:"textBody"`
		HTMLBody      []bodyPart           `json:"htmlBody"`
		BodyValues    map[string]bodyValue `json:"bodyValues"`
	} `json:"list"`
	NotFound []string `json:"notFound"`
}

type bodyValue struct {
	Value string `json:"value"`
}

// MessageHTMLResponse is the body of GET /api/message-html/:emailId.
type MessageHTMLResponse struct {
	HTML          string `json:"html"`
	HasRemote     bool   `json:"hasRemote"`
	RemoteBlocked int    `json:"remoteBlocked"`
	Plain         bool   `json:"plain"`
}

func collectCIDs(p bodyPart, into map[string]bodyPart) {
	if p.CID != "" && p.BlobID != "" && strings.HasPrefix(strings.ToLower(p.Type), "image/") {
		into[strings.Trim(strings.TrimSpace(p.CID), "<>")] = p
	}
	for _, s := range p.SubParts {
		collectCIDs(s, into)
	}
}

func (g *Gateway) handleMessageHTML(w http.ResponseWriter, r *http.Request, a *session.Active) {
	emailID := r.PathValue("emailId")
	if !reID.MatchString(emailID) {
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Invalid message id.")
		return
	}
	loadRemote := r.URL.Query().Get("images") == "1"
	acct, err := g.accountID(r.Context(), r, a)
	if err != nil {
		g.upstreamFailed(w, r, a, "message_html", err)
		return
	}
	doc, err := g.sessionDoc(r.Context(), r, a, false)
	if err != nil {
		g.upstreamFailed(w, r, a, "message_html", err)
		return
	}
	call := []any{[]any{"Email/get", map[string]any{
		"accountId": acct, "ids": []string{emailID},
		"properties":          []string{"id", "bodyStructure", "textBody", "htmlBody", "bodyValues"},
		"fetchHTMLBodyValues": true, "fetchTextBodyValues": true, "maxBodyValueBytes": maxBodyValueBytes,
	}, "0"}}
	reqBody, _ := json.Marshal(map[string]any{
		"using":       []string{jmap.CapCore, jmap.CapMail},
		"methodCalls": call,
	})
	data, status, err := g.client(r.Context(), a).Call(r.Context(), doc, a.Address, a.Credential, g.clientIP(r), reqBody)
	if err != nil {
		g.upstreamFailed(w, r, a, "message_html", err)
		return
	}
	if status != http.StatusOK {
		httpx.Error(w, r, http.StatusBadGateway, "upstream_error", "The mail server could not return the message.")
		return
	}
	var resp emailGetResponse
	var res emailGetResult
	if json.Unmarshal(data, &resp) != nil || len(resp.MethodResponses) != 1 || len(resp.MethodResponses[0]) != 3 ||
		json.Unmarshal(resp.MethodResponses[0][1], &res) != nil {
		httpx.Error(w, r, http.StatusBadGateway, "upstream_error", "The mail server answered in an unexpected way.")
		return
	}
	if len(res.List) == 0 {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "The message was not found.")
		return
	}
	m := res.List[0]
	g.count("message_html", "ok")

	// HTML body: the html-typed parts of htmlBody, in order.
	var htmlSrc strings.Builder
	hasHTML := false
	for _, p := range m.HTMLBody {
		if strings.EqualFold(p.Type, "text/html") {
			hasHTML = true
			htmlSrc.WriteString(m.BodyValues[p.PartID].Value)
		}
	}
	var out sanitize.Result
	if hasHTML {
		cids := map[string]bodyPart{}
		collectCIDs(m.BodyStructure, cids)
		total := int64(0)
		resolve := func(cid string) (string, bool) {
			p, ok := cids[strings.Trim(strings.TrimSpace(cid), "<>")]
			if !ok || p.Size > maxInlineImage || total+p.Size > maxInlineTotal {
				return "", false
			}
			ctype := cleanMediaType(p.Type)
			if !safeImage[ctype] {
				return "", false
			}
			b, err := g.fetchBlob(r.Context(), r, a, doc, acct, p.BlobID, ctype)
			if err != nil {
				return "", false
			}
			total += int64(len(b))
			return "data:" + ctype + ";base64," + base64.StdEncoding.EncodeToString(b), true
		}
		out = sanitize.Sanitize(htmlSrc.String(), sanitize.Options{LoadRemote: loadRemote, ResolveCID: resolve})
	} else {
		var text strings.Builder
		for _, p := range m.TextBody {
			if strings.HasPrefix(strings.ToLower(p.Type), "text/") {
				text.WriteString(m.BodyValues[p.PartID].Value)
			}
		}
		out = sanitize.PlainText(text.String(), sanitize.Options{})
	}
	httpx.JSON(w, http.StatusOK, MessageHTMLResponse{HTML: out.HTML, HasRemote: out.HasRemote, RemoteBlocked: out.Blocked, Plain: out.Plain})
}

// fetchBlob downloads one blob (an inline image) through the upstream
// downloadUrl, bounded by maxInlineImage.
func (g *Gateway) fetchBlob(ctx context.Context, r *http.Request, a *session.Active, doc *jmap.SessionDoc, acct, blobID, ctype string) ([]byte, error) {
	target, err := g.client(r.Context(), a).Resolve(jmap.ExpandTemplate(doc.DownloadURL, map[string]string{
		"accountId": acct, "blobId": blobID, "name": "inline", "type": ctype}))
	if err != nil {
		return nil, err
	}
	req, err := g.client(r.Context(), a).Request(ctx, a.Address, a.Credential, http.MethodGet, target, nil, g.clientIP(r))
	if err != nil {
		return nil, err
	}
	resp, err := g.client(r.Context(), a).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, jmap.ErrUnavailable
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, maxInlineImage+1))
	if err != nil || len(b) > maxInlineImage {
		return nil, jmap.ErrUnavailable
	}
	return b, nil
}
