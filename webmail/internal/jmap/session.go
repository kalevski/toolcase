package jmap

import (
	"encoding/json"
	"net/url"
	"sort"
	"strings"
)

// SessionDoc is the JMAP session resource (RFC 8620 §2). Unknown properties are
// dropped on purpose: the gateway re-publishes only what it understands.
type SessionDoc struct {
	Capabilities    map[string]json.RawMessage `json:"capabilities"`
	Accounts        map[string]Account         `json:"accounts"`
	PrimaryAccounts map[string]string          `json:"primaryAccounts"`
	Username        string                     `json:"username"`
	APIURL          string                     `json:"apiUrl"`
	DownloadURL     string                     `json:"downloadUrl"`
	UploadURL       string                     `json:"uploadUrl"`
	EventSourceURL  string                     `json:"eventSourceUrl"`
	State           string                     `json:"state"`
}

// Account is one entry of accounts.
type Account struct {
	Name                string                     `json:"name"`
	IsPersonal          bool                       `json:"isPersonal"`
	IsReadOnly          bool                       `json:"isReadOnly"`
	AccountCapabilities map[string]json.RawMessage `json:"accountCapabilities"`
}

// OwnAccountID is the user's own mail account: the primary account of the mail
// capability, else the only personal account.
func (d *SessionDoc) OwnAccountID() string {
	if id := d.PrimaryAccounts[MailAccountCapability]; id != "" {
		if _, ok := d.Accounts[id]; ok || len(d.Accounts) == 0 {
			return id
		}
	}
	var personal []string
	for id, a := range d.Accounts {
		if a.IsPersonal {
			personal = append(personal, id)
		}
	}
	sort.Strings(personal)
	if len(personal) > 0 {
		return personal[0]
	}
	return ""
}

// Gateway URL templates (the SPA expands them; paths match gateway routes).
const (
	GatewayAPIURL      = "/api/jmap"
	GatewayDownloadURL = "/api/download/{accountId}/{blobId}/{name}?type={type}"
	GatewayUploadURL   = "/api/upload/{accountId}"
	GatewayEventSource = "/api/eventsource?types={types}&closeafter={closeafter}&ping={ping}"
)

// Rewrite returns the document the browser sees: only the user's own account,
// only allow-listed capabilities, URLs pointing at the gateway.
func (d *SessionDoc) Rewrite(accountID, address string) *SessionDoc {
	out := &SessionDoc{
		Capabilities:    map[string]json.RawMessage{},
		Accounts:        map[string]Account{},
		PrimaryAccounts: map[string]string{},
		Username:        address,
		APIURL:          GatewayAPIURL,
		DownloadURL:     GatewayDownloadURL,
		UploadURL:       GatewayUploadURL,
		EventSourceURL:  GatewayEventSource,
		State:           d.State,
	}
	for k, v := range d.Capabilities {
		if AllowedCapabilities[k] {
			out.Capabilities[k] = v
		}
	}
	if a, ok := d.Accounts[accountID]; ok {
		na := Account{Name: a.Name, IsPersonal: a.IsPersonal, IsReadOnly: a.IsReadOnly, AccountCapabilities: map[string]json.RawMessage{}}
		for k, v := range a.AccountCapabilities {
			if AllowedCapabilities[k] {
				na.AccountCapabilities[k] = v
			}
		}
		out.Accounts[accountID] = na
	}
	for cap, id := range d.PrimaryAccounts {
		if AllowedCapabilities[cap] && id == accountID {
			out.PrimaryAccounts[cap] = id
		}
	}
	return out
}

// ExpandTemplate fills an RFC 6570 level-1 URL template ({var}) with
// path-escaped values. Unknown variables are left empty.
func ExpandTemplate(tpl string, vars map[string]string) string {
	var b strings.Builder
	for {
		i := strings.IndexByte(tpl, '{')
		if i < 0 {
			b.WriteString(tpl)
			break
		}
		j := strings.IndexByte(tpl[i:], '}')
		if j < 0 {
			b.WriteString(tpl)
			break
		}
		b.WriteString(tpl[:i])
		b.WriteString(url.PathEscape(vars[tpl[i+1:i+j]]))
		tpl = tpl[i+j+1:]
	}
	return b.String()
}
