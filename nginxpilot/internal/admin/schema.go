package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
)

// GET /schema serves a hand-kept OpenAPI 3.1 description of the admin surface
// (better.md §5): a control plane generates its client types from it instead of
// hand-mirroring the daemon's JSON. Hand-kept but CI-linted — the schema test
// asserts every routed endpoint carries an operation here and vice versa, so
// the doc can never silently drift from the mux. Unauthenticated like /healthz
// (it describes the API; it contains no data).

// operationDoc is the hand-kept documentation for one endpoint, keyed
// "METHOD /pattern" in operationDocs.
type operationDoc struct {
	summary string
	// requestRef / responseRef name a components/schemas entry ("" = none/plain text).
	requestRef  string
	responseRef string
	// yaml marks a fragment write endpoint (request body is application/yaml).
	yaml bool
}

// operationDocs documents every endpoint. The schema test fails when an
// endpoints() entry is missing here or an entry here has no matching route.
var operationDocs = map[string]operationDoc{
	"GET /healthz": {summary: "Daemon liveness probe (plain text)."},
	"GET /schema":  {summary: "This OpenAPI 3.1 document."},
	"GET /status":  {summary: "Per-site runtime status plus managed-mode resource states, reconcile, real-ip and cert-renewal summaries.", responseRef: "Status"},

	"POST /sync/{domain}": {summary: "Force an immediate content sync of one site."},
	"GET /vhost/{domain}": {summary: "Render the nginx vhost text for a domain (plain text)."},
	"POST /reload":        {summary: "Diff-based config reload — the REST equivalent of SIGHUP."},
	"POST /nginx/test":    {summary: "Managed-mode dry run: the per-resource nginx -t verdicts, without committing.", responseRef: "NginxTestResult"},

	"GET /sites":             {summary: "List configured sites.", responseRef: "SiteList"},
	"POST /sites":            {summary: "Write one site fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /sites/{domain}": {summary: "Remove a site's fragment and reload."},

	"GET /apps":                  {summary: "List configured php apps.", responseRef: "AppList"},
	"POST /apps":                 {summary: "Write one app fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /apps/{domain}":      {summary: "Remove an app's fragment and reload. Its persistent data is kept."},
	"DELETE /apps/{domain}/data": {summary: "Permanently delete an app's persistent data directory."},

	"GET /upstreams":           {summary: "List configured http upstream pools.", responseRef: "UpstreamList"},
	"POST /upstreams":          {summary: "Write one upstream fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /upstreams/{name}": {summary: "Remove an upstream (409 while a proxy still references it)."},

	"GET /proxies":             {summary: "List configured reverse proxies.", responseRef: "ProxyList"},
	"POST /proxies":            {summary: "Write one proxy fragment (validate, persist, reload). Target checks may add warnings or reject (400) with a ?skip_target_checks=true override.", yaml: true, responseRef: "WriteResult"},
	"DELETE /proxies/{domain}": {summary: "Remove a proxy's fragment and reload."},

	"GET /redirects":             {summary: "List configured redirection hosts.", responseRef: "RedirectList"},
	"POST /redirects":            {summary: "Write one redirect fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /redirects/{domain}": {summary: "Remove a redirect's fragment and reload."},

	"GET /dead-hosts":             {summary: "List configured dead (parked) hosts.", responseRef: "DeadHostList"},
	"POST /dead-hosts":            {summary: "Write one dead-host fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /dead-hosts/{domain}": {summary: "Remove a dead host's fragment and reload."},

	"GET /access-lists":                         {summary: "List configured access lists (password hashes masked).", responseRef: "AccessListList"},
	"POST /access-lists":                        {summary: "Write one access-list fragment (validate, persist, reload). Passwords only as password_hash — use the users PUT for plaintext.", yaml: true, responseRef: "WriteResult"},
	"DELETE /access-lists/{name}":               {summary: "Remove an access list (409 while a proxy/redirect/dead host still references it)."},
	"PUT /access-lists/{name}/users/{username}": {summary: "(Re)set one user's password: plaintext in, hashed (apr1) server-side into the fragment, htpasswd regenerated on the reload.", requestRef: "SetPasswordRequest", responseRef: "WriteResult"},

	"GET /streams":           {summary: "List configured L4 stream listeners.", responseRef: "StreamList"},
	"POST /streams":          {summary: "Write one stream fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /streams/{name}": {summary: "Remove a stream's fragment and reload."},

	"GET /stream-upstreams":           {summary: "List configured L4 stream upstream pools.", responseRef: "StreamUpstreamList"},
	"POST /stream-upstreams":          {summary: "Write one stream-upstream fragment (validate, persist, reload).", yaml: true, responseRef: "WriteResult"},
	"DELETE /stream-upstreams/{name}": {summary: "Remove a stream upstream (409 while a stream still references it)."},

	"GET /log-destinations":              {summary: "List configured log-shipping destinations (secrets as env/file refs only).", responseRef: "LogDestinationList"},
	"POST /log-destinations":             {summary: "Write one log-destination fragment (validate, persist, hot-reload the shipper — nginx untouched).", yaml: true, responseRef: "WriteResult"},
	"DELETE /log-destinations/{name}":    {summary: "Remove a log destination's fragment and stop its shipper."},
	"POST /log-destinations/test":        {summary: "Test a CANDIDATE destination before saving: validate it, push one synthetic entry, report the outcome (200/400/502).", yaml: true, responseRef: "LogDestTestResult"},
	"POST /log-destinations/{name}/test": {summary: "Test a saved destination: push one synthetic entry through it.", responseRef: "LogDestTestResult"},
	"GET /logs/status":                   {summary: "Per-destination shipping stats (shipped/dropped/failed_batches/buffer/backlog) plus intake health.", responseRef: "LogsStatus"},

	"GET /certs":                  {summary: "List discovered TLS certificates (metadata only, renewal-scheduler enriched).", responseRef: "CertList"},
	"POST /certs":                 {summary: "Start an async certbot issuance (202 + job id).", requestRef: "IssueCertRequest", responseRef: "CertIssueAccepted"},
	"GET /certs/jobs":             {summary: "List recent async issuance jobs.", responseRef: "CertJobList"},
	"GET /certs/jobs/{id}":        {summary: "Poll one async issuance job.", responseRef: "CertJob"},
	"GET /certs/bundle/{domain}":  {summary: "Export one certificate with its chain and private key (by exact cert name).", responseRef: "CertBundle"},
	"PUT /certs/{domain}":         {summary: "Upload a manual cert/key pair (no certbot).", requestRef: "UploadCertRequest", responseRef: "CertUploadResult"},
	"POST /certs/renew":           {summary: "Renew every certificate near expiry (certbot's plain-text summary)."},
	"POST /certs/{domain}/renew":  {summary: "Force-renew one certificate by name."},
	"POST /certs/{domain}/revoke": {summary: "Revoke a certbot-issued certificate at its CA, optionally deleting it.", requestRef: "RevokeCertRequest", responseRef: "CertRevokeResult"},
	"DELETE /certs/{domain}":      {summary: "Delete a certificate (certbot-managed or manual)."},

	"GET /acme/credentials":                         {summary: "List stored ACME DNS-provider credentials (metadata only).", responseRef: "AcmeCredentialList"},
	"PUT /acme/credentials/{provider}":              {summary: "Store (or replace) a provider's DNS credential.", requestRef: "AcmeCredentialRequest", responseRef: "AcmeCredentialResult"},
	"DELETE /acme/credentials/{provider}":           {summary: "Remove a provider's stored credential (default account)."},
	"PUT /acme/credentials/{provider}/{account}":    {summary: "Store (or replace) one named account's DNS credential for a provider.", requestRef: "AcmeCredentialRequest", responseRef: "AcmeCredentialResult"},
	"DELETE /acme/credentials/{provider}/{account}": {summary: "Remove one named account's stored credential for a provider."},

	"GET /git-credentials":           {summary: "List stored git source credentials (metadata only, never tokens).", responseRef: "GitCredentialList"},
	"PUT /git-credentials/{name}":    {summary: "Store (or replace) a private git source's access token as a daemon-owned 0600 file; reference the returned path via auth.token_file.", requestRef: "GitCredentialRequest", responseRef: "GitCredentialResult"},
	"DELETE /git-credentials/{name}": {summary: "Remove a stored git source credential."},
}

// buildOpenAPI assembles the document from the endpoint table + operationDocs.
func buildOpenAPI() map[string]any {
	paths := map[string]any{}
	for _, e := range endpoints() {
		doc := operationDocs[e.method+" "+e.pattern]
		op := map[string]any{
			"summary":     doc.summary,
			"operationId": operationID(e.method, e.pattern),
			"responses":   responsesFor(e, doc),
		}
		params := paramsFor(e.pattern)
		if e.method == "GET" {
			if _, ok := pagedLists[e.pattern]; ok {
				params = append(params, pageParamsDoc(e.pattern)...)
			}
			if doc.responseRef != "" {
				params = append(params, prettyParamDoc())
			}
		}
		if len(params) > 0 {
			op["parameters"] = params
		}
		if e.method == "POST" || e.method == "PUT" {
			op["requestBody"] = requestBodyFor(doc)
		}
		if e.auth {
			op["security"] = []map[string]any{{"bearerAuth": []string{}}}
		}
		path, ok := paths[e.pattern].(map[string]any)
		if !ok {
			path = map[string]any{}
			paths[e.pattern] = path
		}
		path[strings.ToLower(e.method)] = op
	}
	return map[string]any{
		"openapi": "3.1.0",
		"info": map[string]any{
			"title":       "nginxpilot admin API",
			"description": "The REST surface a control plane drives nginxpilot through: config fragments, certificates, ACME credentials, and runtime status.",
			"version":     "1.0.0",
		},
		"paths": paths,
		"components": map[string]any{
			"securitySchemes": map[string]any{
				"bearerAuth": map[string]any{"type": "http", "scheme": "bearer"},
			},
			"schemas": withPageFields(componentSchemas()),
		},
	}
}

// pagedLists maps each opt-in paginated list route to its list schema; the
// value is true when the route also has a fields=summary view.
var pagedLists = map[string]struct {
	ref     string
	summary bool
}{
	"/sites":            {"SiteList", true},
	"/apps":             {"AppList", false},
	"/upstreams":        {"UpstreamList", false},
	"/proxies":          {"ProxyList", false},
	"/redirects":        {"RedirectList", false},
	"/dead-hosts":       {"DeadHostList", false},
	"/access-lists":     {"AccessListList", false},
	"/streams":          {"StreamList", false},
	"/stream-upstreams": {"StreamUpstreamList", false},
	"/certs":            {"CertList", false},
}

// pageParamsDoc describes limit / cursor / fields for a paginated list route.
func pageParamsDoc(pattern string) []map[string]any {
	fields := []string{"full"}
	desc := "Only full is available on this route."
	if pagedLists[pattern].summary {
		fields = []string{"summary", "full"}
		desc = "summary returns only domain, type (source type) and routing per item; full (default) is the whole object."
	}
	return []map[string]any{
		{
			"name": "limit", "in": "query", "required": false,
			"description": "Opt-in paging: items per page (1-500), ordered by the item's key (domain or name). Omitted = the whole list in one response, as before. Adds next_cursor and total to the body.",
			"schema":      map[string]any{"type": "integer", "minimum": 1, "maximum": 500},
		},
		{
			"name": "cursor", "in": "query", "required": false,
			"description": "Opaque next_cursor from the previous page: everything after its last key. Requires limit; a malformed cursor is a 400.",
			"schema":      map[string]any{"type": "string"},
		},
		{
			"name": "fields", "in": "query", "required": false,
			"description": desc,
			"schema":      map[string]any{"type": "string", "enum": fields, "default": "full"},
		},
	}
}

func prettyParamDoc() map[string]any {
	return map[string]any{
		"name": "pretty", "in": "query", "required": false,
		"description": "Responses are compact JSON; pretty=1 indents them.",
		"schema":      map[string]any{"type": "string", "enum": []string{"1"}},
	}
}

// withPageFields adds the paging envelope (next_cursor, total) to the list
// schemas; both are present only when the request sent limit.
func withPageFields(schemas map[string]any) map[string]any {
	for _, l := range pagedLists {
		sch, ok := schemas[l.ref].(map[string]any)
		if !ok {
			continue
		}
		props, ok := sch["properties"].(map[string]any)
		if !ok {
			continue
		}
		props["next_cursor"] = map[string]any{"type": []string{"string", "null"}, "description": "Present with limit; null on the last page."}
		props["total"] = map[string]any{"type": "integer", "description": "Present with limit; the number of items across all pages."}
	}
	return schemas
}

// operationID derives a stable id: "GET /access-lists" → "getAccessLists".
func operationID(method, pattern string) string {
	var b strings.Builder
	b.WriteString(strings.ToLower(method))
	for _, part := range strings.Split(pattern, "/") {
		part = strings.Trim(part, "{}")
		part = strings.ReplaceAll(part, "-", " ")
		for _, word := range strings.Fields(part) {
			b.WriteString(strings.ToUpper(word[:1]) + word[1:])
		}
	}
	return b.String()
}

// paramsFor extracts {param} path parameters.
func paramsFor(pattern string) []map[string]any {
	var out []map[string]any
	for _, part := range strings.Split(pattern, "/") {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			out = append(out, map[string]any{
				"name":     strings.Trim(part, "{}"),
				"in":       "path",
				"required": true,
				"schema":   map[string]any{"type": "string"},
			})
		}
	}
	return out
}

func requestBodyFor(doc operationDoc) map[string]any {
	if doc.yaml {
		return map[string]any{
			"required":    true,
			"description": "A single-resource config fragment (the same YAML a sites.d/ file would contain).",
			"content": map[string]any{
				"application/yaml": map[string]any{"schema": map[string]any{"type": "string"}},
			},
		}
	}
	schema := map[string]any{"type": "object"}
	if doc.requestRef != "" {
		schema = map[string]any{"$ref": "#/components/schemas/" + doc.requestRef}
	}
	return map[string]any{
		"required": true,
		"content":  map[string]any{"application/json": map[string]any{"schema": schema}},
	}
}

func responsesFor(e endpoint, doc operationDoc) map[string]any {
	ok := map[string]any{"description": "Success"}
	if doc.responseRef != "" {
		ok["content"] = map[string]any{
			"application/json": map[string]any{
				"schema": map[string]any{"$ref": "#/components/schemas/" + doc.responseRef},
			},
		}
	}
	out := map[string]any{"200": ok}
	if e.method == "POST" && doc.yaml {
		out["201"] = map[string]any{"description": "Created"}
	}
	if e.auth {
		out["401"] = map[string]any{"description": "Missing/invalid bearer token"}
	}
	return out
}

// schemaJSON is the encoded document, built once: it derives only from the
// static endpoint table, so rebuilding and re-indenting ~85 KB per request is
// pure waste.
var (
	schemaOnce sync.Once
	schemaBody []byte
	schemaErr  error
)

func schemaJSON() ([]byte, error) {
	schemaOnce.Do(func() {
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		enc.SetIndent("", "  ")
		schemaErr = enc.Encode(buildOpenAPI())
		schemaBody = buf.Bytes()
	})
	return schemaBody, schemaErr
}

func (s *Server) handleSchema(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body, err := schemaJSON()
	if err != nil {
		s.log.Warn("admin schema encode failed", "error", err)
		return
	}
	_, _ = w.Write(body)
}
