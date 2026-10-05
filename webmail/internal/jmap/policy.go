package jmap

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
)

// Capability URNs the gateway lets through (spec §3.6).
const (
	CapCore       = "urn:ietf:params:jmap:core"
	CapMail       = "urn:ietf:params:jmap:mail"
	CapSubmission = "urn:ietf:params:jmap:submission"
	CapVacation   = "urn:ietf:params:jmap:vacationresponse"
	CapQuota      = "urn:ietf:params:jmap:quota"
)

// AllowedCapabilities is the capability allow-list.
var AllowedCapabilities = map[string]bool{
	CapCore: true, CapMail: true, CapSubmission: true, CapVacation: true, CapQuota: true,
}

// AllowedMethods is the method allow-list. Deliberately absent: Email/copy and
// Email/import (cross-account / raw blob ingestion), Blob/*, Principal/*,
// ShareNotification/*, anything vendor-specific.
var AllowedMethods = map[string]bool{
	"Core/echo":   true,
	"Mailbox/get": true, "Mailbox/changes": true, "Mailbox/query": true, "Mailbox/queryChanges": true, "Mailbox/set": true,
	"Thread/get": true, "Thread/changes": true,
	"Email/get": true, "Email/changes": true, "Email/query": true, "Email/queryChanges": true, "Email/set": true,
	"SearchSnippet/get": true,
	"Identity/get":      true, "Identity/changes": true, "Identity/set": true,
	"EmailSubmission/get": true, "EmailSubmission/changes": true, "EmailSubmission/query": true,
	"EmailSubmission/queryChanges": true, "EmailSubmission/set": true,
	"VacationResponse/get": true, "VacationResponse/set": true,
	"Quota/get": true, "Quota/changes": true, "Quota/query": true, "Quota/queryChanges": true,
}

// Limits (spec §3.6).
const (
	MaxBodyBytes = 1 << 20
	MaxCalls     = 32
)

// Violation is a policy rejection, reported to the client as HTTP 403 (or 400
// for a malformed request).
type Violation struct {
	Status  int
	Code    string
	Message string
}

func (v *Violation) Error() string { return v.Code + ": " + v.Message }

// Request is a JMAP request object (RFC 8620 §3.3).
type Request struct {
	Using       []string          `json:"using"`
	MethodCalls []json.RawMessage `json:"methodCalls"`
	CreatedIds  json.RawMessage   `json:"createdIds,omitempty"`
}

// Filter validates a JMAP request body against the allow-lists and returns the
// body to send upstream, with accountId forced to the user's own account in
// every call. Request-level createdIds is dropped.
func Filter(body []byte, accountID string) ([]byte, *Violation) {
	if len(body) > MaxBodyBytes {
		return nil, &Violation{413, "too_large", "Request body is too large."}
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	var req Request
	if err := dec.Decode(&req); err != nil {
		return nil, &Violation{400, "bad_request", "Not a valid JMAP request."}
	}
	if len(req.Using) == 0 || len(req.MethodCalls) == 0 {
		return nil, &Violation{400, "bad_request", "A JMAP request needs using and methodCalls."}
	}
	if len(req.MethodCalls) > MaxCalls {
		return nil, &Violation{403, "too_many_calls", fmt.Sprintf("At most %d method calls per request.", MaxCalls)}
	}
	for _, c := range req.Using {
		if !AllowedCapabilities[c] {
			return nil, &Violation{403, "capability_not_allowed", "Capability not allowed: " + c}
		}
	}
	calls := make([]json.RawMessage, 0, len(req.MethodCalls))
	for i, raw := range req.MethodCalls {
		var triple []json.RawMessage
		if err := json.Unmarshal(raw, &triple); err != nil || len(triple) != 3 {
			return nil, &Violation{400, "bad_request", fmt.Sprintf("Method call %d is not [name, arguments, id].", i)}
		}
		var name string
		if err := json.Unmarshal(triple[0], &name); err != nil {
			return nil, &Violation{400, "bad_request", fmt.Sprintf("Method call %d has no name.", i)}
		}
		if !AllowedMethods[name] {
			return nil, &Violation{403, "method_not_allowed", "Method not allowed: " + name}
		}
		var args map[string]json.RawMessage
		if err := json.Unmarshal(triple[1], &args); err != nil || args == nil {
			return nil, &Violation{400, "bad_request", fmt.Sprintf("Method call %d arguments must be an object.", i)}
		}
		// A client-supplied accountId (or a "#accountId" back-reference, which
		// could point at another account) is replaced, never trusted.
		delete(args, "#accountId")
		id, _ := json.Marshal(accountID)
		args["accountId"] = id
		if _, has := args["fromAccountId"]; has {
			return nil, &Violation{403, "account_not_allowed", "Cross-account access is not allowed."}
		}
		newArgs, err := marshalSorted(args)
		if err != nil {
			return nil, &Violation{400, "bad_request", "Could not encode arguments."}
		}
		t, _ := json.Marshal([]json.RawMessage{triple[0], newArgs, triple[2]})
		calls = append(calls, t)
	}
	out, err := json.Marshal(Request{Using: req.Using, MethodCalls: calls})
	if err != nil {
		return nil, &Violation{400, "bad_request", "Could not encode request."}
	}
	return out, nil
}

func marshalSorted(m map[string]json.RawMessage) (json.RawMessage, error) {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b bytes.Buffer
	b.WriteByte('{')
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(',')
		}
		kb, _ := json.Marshal(k)
		b.Write(kb)
		b.WriteByte(':')
		b.Write(m[k])
	}
	b.WriteByte('}')
	if !json.Valid(b.Bytes()) {
		return nil, errors.New("invalid")
	}
	return b.Bytes(), nil
}
