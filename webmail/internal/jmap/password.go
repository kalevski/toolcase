package jmap

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ErrNotApplied is a password change the mail server acknowledged but did not
// carry out: the new password still does not sign in. It wraps ErrUnavailable.
var ErrNotApplied = fmt.Errorf("%w: the mail server did not apply the new password", ErrUnavailable)

// errNoStalwartAPI means the JMAP route is not offered to this user, so the
// legacy endpoint is tried instead.
var errNoStalwartAPI = errors.New("jmap: no Stalwart management methods for this user")

// ChangePassword sets a new password for address, authenticating with the
// current one: a wrong current password is ErrUnauthorized, a refused new one a
// *PolicyError. The mail server does the work; nothing else holds the password.
//
// Stalwart 0.16 manages accounts through JMAP (x:Account/set on the account's
// credentials), which is tried first; the 0.10–0.15 endpoint is the fallback.
// Whatever answered, the change only counts once the new password signs in:
// a server that acknowledges and ignores the request is ErrNotApplied, never a
// success.
func (c *Client) ChangePassword(ctx context.Context, address, current, next, xff string) error {
	doc, err := c.Session(ctx, address, current, xff)
	if err != nil {
		return err
	}
	err = c.changeOverJMAP(ctx, doc, address, current, next, xff)
	if errors.Is(err, errNoStalwartAPI) {
		err = c.changeOverLegacy(ctx, address, current, next, xff)
	}
	if err != nil {
		return err
	}
	return c.confirm(ctx, address, next, xff)
}

func (c *Client) confirm(ctx context.Context, address, next, xff string) error {
	if _, err := c.Session(ctx, address, next, xff); err != nil {
		if errors.Is(err, ErrUnauthorized) {
			return ErrNotApplied
		}
		return err
	}
	return nil
}

type jmapError struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

func (c *Client) stalwart(ctx context.Context, doc *SessionDoc, address, credential, xff, method string, args map[string]any) (map[string]json.RawMessage, error) {
	body, _ := json.Marshal(map[string]any{
		"using":       []string{"urn:ietf:params:jmap:core", StalwartCapability},
		"methodCalls": []any{[]any{method, args, "c0"}},
	})
	data, status, err := c.Call(ctx, doc, address, credential, xff, body)
	if err != nil {
		return nil, err
	}
	if status == http.StatusForbidden || status == http.StatusNotFound {
		return nil, errNoStalwartAPI
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("%w: %s answered %d", ErrUnavailable, method, status)
	}
	var out struct {
		MethodResponses [][]json.RawMessage `json:"methodResponses"`
	}
	if err := json.Unmarshal(data, &out); err != nil || len(out.MethodResponses) == 0 || len(out.MethodResponses[0]) < 2 {
		return nil, fmt.Errorf("%w: %s answered no method response", ErrUnavailable, method)
	}
	var name string
	_ = json.Unmarshal(out.MethodResponses[0][0], &name)
	if name == "error" {
		var e jmapError
		_ = json.Unmarshal(out.MethodResponses[0][1], &e)
		switch e.Type {
		case "forbidden", "unknownMethod", "accountNotFound", "unknownCapability":
			return nil, errNoStalwartAPI
		}
		return nil, fmt.Errorf("%w: %s: %s %s", ErrUnavailable, method, e.Type, e.Description)
	}
	var result map[string]json.RawMessage
	if err := json.Unmarshal(out.MethodResponses[0][1], &result); err != nil {
		return nil, fmt.Errorf("%w: %s: bad response", ErrUnavailable, method)
	}
	return result, nil
}

func firstID(result map[string]json.RawMessage) string {
	var ids []string
	_ = json.Unmarshal(result["ids"], &ids)
	if len(ids) == 0 {
		return ""
	}
	return ids[0]
}

func (c *Client) changeOverJMAP(ctx context.Context, doc *SessionDoc, address, current, next, xff string) error {
	if _, ok := doc.Capabilities[StalwartCapability]; !ok {
		return errNoStalwartAPI
	}
	accountID := doc.PrimaryAccounts[StalwartCapability]
	if accountID == "" {
		accountID = doc.OwnAccountID()
	}
	at := strings.LastIndexByte(address, '@')
	if accountID == "" || at <= 0 {
		return errNoStalwartAPI
	}
	local, domain := address[:at], strings.ToLower(address[at+1:])
	call := func(method string, args map[string]any) (map[string]json.RawMessage, error) {
		args["accountId"] = accountID
		return c.stalwart(ctx, doc, address, current, xff, method, args)
	}

	domains, err := call("x:Domain/query", map[string]any{"filter": map[string]any{"name": domain}, "limit": 1})
	if err != nil {
		return err
	}
	domainID := firstID(domains)
	if domainID == "" {
		return errNoStalwartAPI
	}
	accounts, err := call("x:Account/query", map[string]any{"filter": map[string]any{"name": local, "domainId": domainID}, "limit": 1})
	if err != nil {
		return err
	}
	id := firstID(accounts)
	if id == "" {
		return errNoStalwartAPI
	}
	got, err := call("x:Account/get", map[string]any{"ids": []string{id}, "properties": []string{"credentials"}})
	if err != nil {
		return err
	}
	var list []struct {
		Credentials map[string]struct {
			Type string `json:"@type"`
		} `json:"credentials"`
	}
	_ = json.Unmarshal(got["list"], &list)
	update := map[string]any{"credentials/0": map[string]any{"@type": "Password", "secret": next}}
	if len(list) > 0 {
		for key, credential := range list[0].Credentials {
			if credential.Type == "Password" {
				update = map[string]any{"credentials/" + key + "/secret": next}
				break
			}
		}
	}
	set, err := call("x:Account/set", map[string]any{"update": map[string]any{id: update}})
	if err != nil {
		return err
	}
	var notUpdated map[string]jmapError
	_ = json.Unmarshal(set["notUpdated"], &notUpdated)
	if failure, ok := notUpdated[id]; ok {
		if failure.Type == "forbidden" {
			return errNoStalwartAPI
		}
		message := failure.Description
		if message == "" || len(message) > 300 {
			message = "The new password was not accepted."
		}
		return &PolicyError{Message: message}
	}
	return nil
}

func (c *Client) changeOverLegacy(ctx context.Context, address, current, next, xff string) error {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	body, _ := json.Marshal([]map[string]string{{"type": "changePassword", "password": next}})
	req, err := c.Request(ctx, address, current, http.MethodPost, c.Base+AccountAuthPath, bytes.NewReader(body), xff)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	case resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity:
		return &PolicyError{Message: refusal(data)}
	}
	return fmt.Errorf("%w: password change answered %d", ErrUnavailable, resp.StatusCode)
}
