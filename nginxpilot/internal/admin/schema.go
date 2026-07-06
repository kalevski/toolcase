package admin

import (
	"net/http"
	"strings"
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

	"GET /certs":                 {summary: "List discovered TLS certificates (metadata only, renewal-scheduler enriched).", responseRef: "CertList"},
	"POST /certs":                {summary: "Start an async certbot issuance (202 + job id).", requestRef: "IssueCertRequest", responseRef: "CertIssueAccepted"},
	"GET /certs/jobs":            {summary: "List recent async issuance jobs.", responseRef: "CertJobList"},
	"GET /certs/jobs/{id}":       {summary: "Poll one async issuance job.", responseRef: "CertJob"},
	"PUT /certs/{domain}":        {summary: "Upload a manual cert/key pair (no certbot).", requestRef: "UploadCertRequest", responseRef: "CertUploadResult"},
	"POST /certs/renew":          {summary: "Renew every certificate near expiry (certbot's plain-text summary)."},
	"POST /certs/{domain}/renew": {summary: "Force-renew one certificate by name."},
	"DELETE /certs/{domain}":     {summary: "Delete a certificate (certbot-managed or manual)."},

	"GET /acme/credentials":               {summary: "List stored ACME DNS-provider credentials (metadata only).", responseRef: "AcmeCredentialList"},
	"PUT /acme/credentials/{provider}":    {summary: "Store (or replace) a provider's DNS credential.", requestRef: "AcmeCredentialRequest", responseRef: "AcmeCredentialResult"},
	"DELETE /acme/credentials/{provider}": {summary: "Remove a provider's stored credential."},

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
		if params := paramsFor(e.pattern); len(params) > 0 {
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
			"schemas": componentSchemas(),
		},
	}
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

func (s *Server) handleSchema(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	writeJSON(w, buildOpenAPI(), s)
}
