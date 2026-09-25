package admin

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/zonefile"
)

// maxBodyBytes caps a request body. A zone with a few thousand records fits
// comfortably; anything larger is a client error.
const maxBodyBytes = 1 << 20

// ZoneView is a zone as the API returns it: its config plus runtime state.
type ZoneView struct {
	config.Zone
	Serial uint32 `json:"serial"`
	State  string `json:"state"`
	Reason string `json:"reason,omitempty"`
	// Source is "replicated" (API-managed, synchronized between servers) or
	// "local" (declared in a config file, read-only over the API).
	Source  string `json:"source"`
	Managed bool   `json:"managed"`
	ETag    string `json:"etag"`
}

func source(z *config.Zone) string {
	if z.File == config.ReplicatedFile {
		return "replicated"
	}
	return "local"
}

func (s *Server) view(z *config.Zone) ZoneView {
	v := ZoneView{Zone: *z, Serial: s.mgr.Serial(z.Name), State: "pending", Source: source(z), ETag: s.mgr.ETag(z)}
	v.Managed = v.Source == "replicated"
	if v.Records == nil {
		v.Records = []config.Record{}
	}
	if last, ok := s.mgr.LastApply(); ok {
		if zr := last.Zone(z.Name); zr != nil {
			v.State, v.Reason = zr.State, zr.Reason
		}
	}
	return v
}

func (s *Server) handleListZones(w http.ResponseWriter, _ *http.Request) {
	eff, _ := s.mgr.Effective()
	out := make([]ZoneView, 0, len(eff.Zones))
	for i := range eff.Zones {
		out = append(out, s.view(&eff.Zones[i]))
	}
	writeJSON(w, http.StatusOK, map[string]any{"zones": out}, s)
}

// lookupZone resolves the {zone} path value against the effective config,
// writing 400/404 and returning nil when it does not resolve.
func (s *Server) lookupZone(w http.ResponseWriter, r *http.Request) (*config.Config, *config.Zone) {
	name, err := config.NormalizeZoneName(r.PathValue("zone"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return nil, nil
	}
	eff, _ := s.mgr.Effective()
	i := eff.FindZone(name)
	if i < 0 {
		writeError(w, http.StatusNotFound, "zone "+name+" not found")
		return nil, nil
	}
	return eff, &eff.Zones[i]
}

func (s *Server) handleGetZone(w http.ResponseWriter, r *http.Request) {
	_, z := s.lookupZone(w, r)
	if z == nil {
		return
	}
	v := s.view(z)
	w.Header().Set("ETag", v.ETag)
	writeJSON(w, http.StatusOK, v, s)
}

// handleZoneFile renders the zone file text with its published serial.
func (s *Server) handleZoneFile(w http.ResponseWriter, r *http.Request) {
	eff, z := s.lookupZone(w, r)
	if z == nil {
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(zonefile.Render(eff, z, s.mgr.Serial(z.Name))))
}

// handleCreateZone accepts a fragment declaring exactly one zone — the same
// YAML (or JSON) a zones.d/ file would contain — and creates or replaces it.
func (s *Server) handleCreateZone(w http.ResponseWriter, r *http.Request) {
	body, ok := readBody(w, r)
	if !ok {
		return
	}
	frag, err := config.ParseFragment(body, "<admin POST /zones>")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid fragment: "+err.Error())
		return
	}
	if len(frag.Zones) != 1 {
		writeError(w, http.StatusBadRequest, "fragment must declare exactly one zone")
		return
	}
	desired := frag.Zones[0]
	s.write(w, r, desired.Name, func(cur manager.Current) (*config.Zone, error) { return &desired, nil })
}

// handlePutZone creates or replaces the zone named by the path from a bare
// zone object (YAML or JSON). A name in the body, if given, must match.
func (s *Server) handlePutZone(w http.ResponseWriter, r *http.Request) {
	body, ok := readBody(w, r)
	if !ok {
		return
	}
	desired, err := config.ParseZone(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid zone: "+err.Error())
		return
	}
	path, err := config.NormalizeZoneName(r.PathValue("zone"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if desired.Name != "" {
		if n, err := config.NormalizeZoneName(desired.Name); err != nil || n != path {
			writeError(w, http.StatusBadRequest, "body names zone "+desired.Name+" but the path names "+path)
			return
		}
	}
	s.write(w, r, path, func(cur manager.Current) (*config.Zone, error) { return desired, nil })
}

func (s *Server) handleDeleteZone(w http.ResponseWriter, r *http.Request) {
	s.write(w, r, r.PathValue("zone"), func(cur manager.Current) (*config.Zone, error) {
		if !cur.Exists {
			return nil, manager.Errorf(http.StatusNotFound, "zone %s not found", cur.Zone.Name)
		}
		return nil, nil
	})
}

// write runs one mutation through the manager's write path, adding the
// If-Match precondition and ?wait=replicated, and writes the response.
func (s *Server) write(w http.ResponseWriter, r *http.Request, zone string, fn func(manager.Current) (*config.Zone, error)) {
	s.writeAs(w, r, zone, false, fn)
}

// writeAs is write; created reports a successful change as 201 "created"
// (adding a record creates a resource even though its zone already existed).
func (s *Server) writeAs(w http.ResponseWriter, r *http.Request, zone string, created bool, fn func(manager.Current) (*config.Zone, error)) {
	ifMatch := r.Header.Get("If-Match")
	out, err := s.mgr.Mutate(r.Context(), zone, func(cur manager.Current) (*config.Zone, error) {
		if ifMatch != "" && (!cur.Exists || (ifMatch != "*" && ifMatch != cur.ETag)) {
			return nil, manager.Errorf(http.StatusPreconditionFailed, "zone changed since it was read (If-Match %s, current %s)", ifMatch, orNone(cur.ETag))
		}
		return fn(cur)
	})
	if err != nil {
		var we *manager.WriteError
		if errors.As(err, &we) {
			writeError(w, we.Code, we.Msg)
			return
		}
		s.log.Error("write failed", "zone", zone, "error", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	name, _ := config.NormalizeZoneName(zone)
	resp := map[string]any{"status": out.Status, "zone": name, "serial": out.Serial, "reloaded": out.Apply.Reloaded}
	if zr := out.Apply.Zone(name); zr != nil {
		resp["state"] = zr.State
	}
	if len(out.Ops) > 0 {
		last := out.Ops[len(out.Ops)-1]
		resp["op"], resp["hlc"] = last.ID(), uint64(last.HLC)
	}
	if out.Apply.ReloadError != "" {
		resp["reload_error"], resp["pending_reload"] = out.Apply.ReloadError, true
	}
	if eff, _ := s.mgr.Effective(); eff.FindZone(name) >= 0 {
		etag := s.mgr.ETag(&eff.Zones[eff.FindZone(name)])
		w.Header().Set("ETag", etag)
		resp["etag"] = etag
	}

	if created && out.Status == "updated" {
		out.Status = "created"
		resp["status"] = out.Status
	}
	code := http.StatusOK
	if out.Status == "created" {
		code = http.StatusCreated
	}
	if r.URL.Query().Get("wait") == "replicated" && len(out.Ops) > 0 {
		if s.cluster == nil {
			resp["replicated"] = true // a single node is trivially replicated
		} else {
			pending := s.cluster.WaitReplicated(r.Context(), out.Ops, waitTimeout(r))
			resp["replicated"] = len(pending) == 0
			if len(pending) > 0 {
				resp["pending_peers"] = pending
				code = http.StatusAccepted
			}
		}
	}
	writeJSON(w, code, resp, s)
}

// waitTimeout parses ?timeout= (default 10s, max 60s).
func waitTimeout(r *http.Request) time.Duration {
	t := 10 * time.Second
	if v := r.URL.Query().Get("timeout"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			t = d
		} else if n, err := strconv.Atoi(v); err == nil && n > 0 {
			t = time.Duration(n) * time.Second
		}
	}
	return min(t, time.Minute)
}

func orNone(s string) string {
	if s == "" {
		return "none (zone does not exist)"
	}
	return s
}

// readBody reads and size-limits a request body.
func readBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "read body failed")
		return nil, false
	}
	if len(body) > maxBodyBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return nil, false
	}
	return body, true
}
