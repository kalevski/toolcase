package admin

import (
	"fmt"
	"net/http"
	"regexp"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// logDestStemPrefix namespaces log-destination fragment files
// (logdest-<name>.yml) so they can never collide with another entity kind.
const logDestStemPrefix = "logdest-"

// logDestNameRe mirrors config's slug rule (G10): the name is a filename
// component, guarded against path tricks like the credstore's provider names.
var logDestNameRe = regexp.MustCompile(`^[a-z0-9-]+$`)

// handleListLogDests lists configured log destinations. Secret material is
// never present — auth carries only *_env / *_file references.
func (s *Server) handleListLogDests(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	dests := cfg.LogDestinations
	if dests == nil {
		dests = []config.LogDestination{}
	}
	writeJSON(w, map[string]any{"log_destinations": dests}, s)
}

// handleCreateLogDest accepts a fragment declaring exactly one log
// destination, validates the candidate merged config, writes
// logdest-<name>.yml atomically and reloads. The reload reconfigures the
// shipper without touching nginx (unless logs.access.* changed, which
// re-renders vhosts on the same diff path as everything else).
func (s *Server) handleCreateLogDest(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /log-destinations>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "log_destination"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	name := frag.LogDestinations[0].Name
	if !logDestNameRe.MatchString(name) {
		http.Error(w, "invalid log destination name: must match [a-z0-9-]+", http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, logDestStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "log_destination", name, nil)
}

// handleDeleteLogDest removes the deterministic fragment for a destination
// and reloads (the shipper stops the worker on the reload).
func (s *Server) handleDeleteLogDest(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	name := r.PathValue("name")
	if !logDestNameRe.MatchString(name) {
		http.Error(w, "invalid log destination name: must match [a-z0-9-]+", http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, logDestStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.removeFragmentAndReload(w, target, "log_destination", name)
}

// handleLogsStatus serves the shipping stats standalone (also embedded in
// GET /status as the `logs` object).
func (s *Server) handleLogsStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, s.mgr.LogsStatus(), s)
}

// handleTestLogDest is the body-based "Test connection" (G11): it accepts a
// candidate destination (a fragment declaring exactly one, secrets by
// reference), validates it standalone, pushes one synthetic test entry and
// reports the outcome — usable BEFORE saving, like POST /nginx/test.
func (s *Server) handleTestLogDest(w http.ResponseWriter, r *http.Request) {
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}
	frag, err := config.ParseFragment(body, "<admin POST /log-destinations/test>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "log_destination"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.runLogDestTest(w, r, &frag.LogDestinations[0])
}

// handleTestSavedLogDest is the {name}/test sugar: load the saved destination
// and push the synthetic entry through it.
func (s *Server) handleTestSavedLogDest(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	cfg := s.mgr.Config()
	for i := range cfg.LogDestinations {
		if cfg.LogDestinations[i].Name == name {
			s.runLogDestTest(w, r, &cfg.LogDestinations[i])
			return
		}
	}
	http.Error(w, "unknown log destination", http.StatusNotFound)
}

// runLogDestTest validates one destination in isolation (the same per-entity
// checks a write would run, minus the duplicate-name gate — a candidate may
// deliberately share the name of the destination it will replace), pushes the
// test entry, and writes {ok, error} — 200 on delivery, 400 on validation
// failure, 502 when the destination rejected/was unreachable.
func (s *Server) runLogDestTest(w http.ResponseWriter, r *http.Request, d *config.LogDestination) {
	if err := config.ValidateLogDestinationStandalone(s.mgr.Config(), d); err != nil {
		http.Error(w, fmt.Sprintf("destination rejected: %v", err), http.StatusBadRequest)
		return
	}
	if err := s.mgr.TestLogDestination(r.Context(), d); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		writeJSON(w, map[string]any{"ok": false, "name": d.Name, "error": err.Error()}, s)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "name": d.Name}, s)
}
