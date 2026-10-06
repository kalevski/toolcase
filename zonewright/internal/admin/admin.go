// Package admin serves the zonewright HTTP API:
//
//	GET    /healthz                               daemon liveness (no auth)
//	GET    /status                                per-zone state + last apply
//	POST   /reload                                re-read config from disk and apply (same as SIGHUP)
//	GET    /lookup?name=<fqdn>                    the zone that holds a name, and the name relative to it
//
//	GET    /zones                                 list zones (replicated + local); ?view=full|summary, ?limit=1..500&cursor=
//	POST   /zones                                 create/replace one zone (YAML or JSON fragment)
//	GET    /zones/{zone}                          one zone (ETag)
//	PUT    /zones/{zone}                          create/replace one zone (YAML or JSON zone object)
//	DELETE /zones/{zone}                          remove a zone
//	GET    /zones/{zone}/file                     the rendered zone file (text)
//
//	GET    /zones/{zone}/records                  list records (?name=&type= filters, ?limit=&cursor=)
//	POST   /zones/{zone}/records                  add one record (JSON)
//	PUT    /zones/{zone}/records/{name}/{type}    replace one RRset (JSON {"records":[…]})
//	DELETE /zones/{zone}/records/{name}/{type}    delete one RRset, or one record with ?value=
//
//	GET    /tokens                                scoped tokens (config + API), never secrets
//	POST   /tokens                                create a replicated scoped token; returns its secret once
//	PUT    /tokens/{name}                         replace an API token's scope/zones (secret unchanged)
//	POST   /tokens/{name}/rotate                  new secret for an API token
//	DELETE /tokens/{name}                         revoke an API token everywhere
//
//	GET    /cluster/status                        replication view (cluster mode)
//	DELETE /cluster/peers/{id}                    retire a removed server's id
//
// Zones created over the API live in the replicated store and synchronize
// between servers; zones declared in config files are local and read-only
// here. Every write is validated and pre-checked with named-checkzone BEFORE
// it is committed — a committed change replicates and cannot be rolled back,
// so the API never commits a zone BIND would not load. Writes accept
// If-Match (412 on a stale ETag) and ?wait=replicated.
//
// Responses are compact JSON; add ?pretty=1 to any request for indented output.
//
// Lists page only on request: without ?limit=/?cursor= GET /zones and
// GET /zones/{zone}/records return everything, as before. With either, the
// list is ordered (zones by name, records by name, type, rdata) and the body
// adds "next_cursor" (null on the last page) and "total". A cursor is opaque
// and means "everything after this key", so edits between pages never skip or
// repeat an item. view=summary drops the records: name, serial, state, source,
// managed, record_count, etag (ETags come from a per-zone cache).
//
// Next to the admin token, limited tokens come from admin.scoped_tokens (this
// server only) or from /tokens (replicated, managed with the admin token).
// The only scope, "acme", reaches GET /lookup and the three record-write
// endpoints, for TXT records named _acme-challenge[.<name>] in its zones.
package admin

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// ReloadFunc re-reads the on-disk config, validates it and applies it. An
// error means the config was rejected and the running one kept.
type ReloadFunc func(ctx context.Context) (bindctl.ApplyResult, error)

// Cluster is the replication agent as the API sees it (nil on a single node).
type Cluster interface {
	ClusterStatus() any
	WaitReplicated(ctx context.Context, ops []store.Op, timeout time.Duration) []string
	Retire(id string) error
}

// Server is the admin HTTP endpoint.
type Server struct {
	mgr     *manager.Manager
	token   string
	log     *slog.Logger
	reload  ReloadFunc
	cluster Cluster
	tls     [2]string
	scoped  []ScopedToken
}

// New builds the admin server. token may be empty only when no auth is
// configured; reload may be nil (POST /reload → 501).
func New(mgr *manager.Manager, token string, log *slog.Logger, reload ReloadFunc) *Server {
	return &Server{mgr: mgr, token: token, log: log, reload: reload}
}

// SetCluster enables the cluster endpoints and ?wait=replicated.
func (s *Server) SetCluster(c Cluster) { s.cluster = c }

// SetTLS serves HTTPS with the given certificate and key.
func (s *Server) SetTLS(certFile, keyFile string) { s.tls = [2]string{certFile, keyFile} }

// Run serves until ctx is cancelled. An empty listen address disables the
// endpoint entirely.
func (s *Server) Run(ctx context.Context, listen string) error {
	if listen == "" {
		s.log.Info("admin endpoint disabled")
		<-ctx.Done()
		return nil
	}
	// Every phase of a request is bounded so a slow client cannot pin
	// connections (slowloris). WriteTimeout covers the handler too: a write
	// runs named-checkzone + rndc (30s each) and may wait for replication.
	srv := &http.Server{
		Addr:              listen,
		Handler:           s.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      3 * time.Minute,
		IdleTimeout:       2 * time.Minute,
		MaxHeaderBytes:    64 << 10,
	}
	errCh := make(chan error, 1)
	go func() {
		if s.tls[0] != "" {
			errCh <- srv.ListenAndServeTLS(s.tls[0], s.tls[1])
		} else {
			errCh <- srv.ListenAndServe()
		}
	}()
	s.log.Info("admin endpoint listening", "addr", listen, "tls", s.tls[0] != "")
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return nil
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

type endpoint struct {
	method  string
	pattern string
	auth    bool
	// acme marks the endpoints an "acme"-scoped token may call (its record
	// writes are further limited to _acme-challenge TXT in the handlers).
	acme    bool
	handler func(s *Server) http.HandlerFunc
}

func endpoints() []endpoint {
	return []endpoint{
		{"GET", "/healthz", false, false, func(s *Server) http.HandlerFunc { return s.handleHealthz }},
		{"GET", "/status", true, false, func(s *Server) http.HandlerFunc { return s.handleStatus }},
		{"POST", "/reload", true, false, func(s *Server) http.HandlerFunc { return s.handleReload }},
		{"GET", "/lookup", true, true, func(s *Server) http.HandlerFunc { return s.handleLookup }},

		{"GET", "/zones", true, false, func(s *Server) http.HandlerFunc { return s.handleListZones }},
		{"POST", "/zones", true, false, func(s *Server) http.HandlerFunc { return s.handleCreateZone }},
		{"GET", "/zones/{zone}", true, false, func(s *Server) http.HandlerFunc { return s.handleGetZone }},
		{"PUT", "/zones/{zone}", true, false, func(s *Server) http.HandlerFunc { return s.handlePutZone }},
		{"DELETE", "/zones/{zone}", true, false, func(s *Server) http.HandlerFunc { return s.handleDeleteZone }},
		{"GET", "/zones/{zone}/file", true, false, func(s *Server) http.HandlerFunc { return s.handleZoneFile }},

		{"GET", "/zones/{zone}/records", true, false, func(s *Server) http.HandlerFunc { return s.handleListRecords }},
		{"POST", "/zones/{zone}/records", true, true, func(s *Server) http.HandlerFunc { return s.handleAddRecord }},
		{"PUT", "/zones/{zone}/records/{name}/{type}", true, true, func(s *Server) http.HandlerFunc { return s.handlePutRRset }},
		{"DELETE", "/zones/{zone}/records/{name}/{type}", true, true, func(s *Server) http.HandlerFunc { return s.handleDeleteRRset }},

		{"GET", "/tokens", true, false, func(s *Server) http.HandlerFunc { return s.handleListTokens }},
		{"POST", "/tokens", true, false, func(s *Server) http.HandlerFunc { return s.handleCreateToken }},
		{"PUT", "/tokens/{name}", true, false, func(s *Server) http.HandlerFunc { return s.handleUpdateToken }},
		{"POST", "/tokens/{name}/rotate", true, false, func(s *Server) http.HandlerFunc { return s.handleRotateToken }},
		{"DELETE", "/tokens/{name}", true, false, func(s *Server) http.HandlerFunc { return s.handleDeleteToken }},

		{"GET", "/cluster/status", true, false, func(s *Server) http.HandlerFunc { return s.handleClusterStatus }},
		{"DELETE", "/cluster/peers/{id}", true, false, func(s *Server) http.HandlerFunc { return s.handleRetirePeer }},
	}
}

// Routes returns the HTTP handler.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	for _, e := range endpoints() {
		h := e.handler(s)
		if e.auth {
			h = s.auth(e, h)
		}
		mux.HandleFunc(e.method+" "+e.pattern, h)
	}
	return s.guard(mux)
}

// guard rejects every request a browser could have been tricked into
// sending. The API has no browser client, so any request carrying browser
// fetch metadata is refused outright — that closes cross-site request
// forgery (a "simple" text/plain POST needs no CORS preflight). Without a
// token it additionally pins the Host header to loopback names, which defeats
// DNS rebinding (a rebound page sends its own hostname as Host).
func (s *Server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		if r.Header.Get("Origin") != "" || r.Header.Get("Sec-Fetch-Site") != "" || r.Header.Get("Sec-Fetch-Mode") != "" {
			writeError(w, http.StatusForbidden, "browser requests are not accepted")
			return
		}
		if s.token == "" && !loopbackHost(r.Host) {
			writeError(w, http.StatusForbidden, "without an admin token only loopback Host headers are accepted")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// loopbackHost reports whether a Host header names the local machine.
func loopbackHost(host string) bool {
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.TrimSuffix(strings.Trim(host, "[]"), ".")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip, err := netip.ParseAddr(host)
	return err == nil && ip.IsLoopback()
}

// auth enforces the optional bearer token. The admin token may call every
// endpoint; a scoped token only the endpoints and zones its scope allows.
func (s *Server) auth(e endpoint, next http.HandlerFunc) http.HandlerFunc {
	if s.token == "" {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		full := subtle.ConstantTimeCompare([]byte(got), []byte(s.token)) == 1
		scoped := s.matchScoped(got)
		switch {
		case full:
			next(w, r)
		case scoped != nil:
			if !admitScoped(w, r, e, scoped) {
				return
			}
			next(w, r.WithContext(context.WithValue(r.Context(), scopedKey{}, scoped)))
		default:
			writeError(w, http.StatusUnauthorized, "unauthorized")
		}
	}
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok\n"))
}

// ZoneStatus is one row of GET /status.
type ZoneStatus struct {
	Zone    string `json:"zone"`
	Source  string `json:"source"` // replicated | local
	State   string `json:"state"`
	Serial  uint32 `json:"serial"`
	Records int    `json:"records"`
	Reason  string `json:"reason,omitempty"`
}

// Status is the GET /status payload.
type Status struct {
	NodeID        string               `json:"node_id"`
	Zones         []ZoneStatus         `json:"zones"`
	Conflicts     []manager.Conflict   `json:"conflicts"`
	LastApply     *bindctl.ApplyResult `json:"last_apply,omitempty"`
	PendingReload bool                 `json:"pending_reload"`
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	eff, _ := s.mgr.Effective()
	last, ok := s.mgr.LastApply()
	out := Status{NodeID: s.mgr.Store().NodeID(), Zones: []ZoneStatus{}, Conflicts: s.mgr.Conflicts(), PendingReload: s.mgr.PendingRetry()}
	if out.Conflicts == nil {
		out.Conflicts = []manager.Conflict{}
	}
	if ok {
		out.LastApply = &last
	}
	for i := range eff.Zones {
		z := &eff.Zones[i]
		zs := ZoneStatus{Zone: z.Name, Source: source(z), State: "pending", Serial: s.mgr.Serial(z.Name), Records: len(z.Records)}
		if ok {
			if zr := last.Zone(z.Name); zr != nil {
				zs.State, zs.Reason = zr.State, zr.Reason
			}
		}
		out.Zones = append(out.Zones, zs)
	}
	writeJSON(w, r, http.StatusOK, out, s)
}

func (s *Server) handleReload(w http.ResponseWriter, r *http.Request) {
	if s.reload == nil {
		writeError(w, http.StatusNotImplemented, "reload not available")
		return
	}
	res, err := s.reload(r.Context())
	if err != nil {
		writeError(w, http.StatusBadRequest, "reload rejected, running config kept: "+err.Error())
		return
	}
	writeJSON(w, r, http.StatusOK, res, s)
}

func (s *Server) handleClusterStatus(w http.ResponseWriter, r *http.Request) {
	if s.cluster == nil {
		writeError(w, http.StatusNotImplemented, "not a cluster: no cluster: block in the config")
		return
	}
	writeJSON(w, r, http.StatusOK, s.cluster.ClusterStatus(), s)
}

func (s *Server) handleRetirePeer(w http.ResponseWriter, r *http.Request) {
	if s.cluster == nil {
		writeError(w, http.StatusNotImplemented, "not a cluster: no cluster: block in the config")
		return
	}
	if err := s.cluster.Retire(r.PathValue("id")); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]string{"status": "retired", "id": r.PathValue("id")}, s)
}

// wantPretty reports whether the caller asked for indented JSON (?pretty=1).
// Output is compact otherwise; error bodies (no request) are always compact.
func wantPretty(r *http.Request) bool {
	if r == nil {
		return false
	}
	switch r.URL.Query().Get("pretty") {
	case "1", "true":
		return true
	}
	return false
}

func writeJSON(w http.ResponseWriter, r *http.Request, code int, v any, s *Server) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	if wantPretty(r) {
		enc.SetIndent("", "  ")
	}
	if err := enc.Encode(v); err != nil && s != nil {
		s.log.Warn("admin encode failed", "error", err)
	}
}

// writeError responds with {"error": msg}. Every error is JSON so API clients
// have one shape to parse.
func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, nil, code, map[string]string{"error": msg}, nil)
}
