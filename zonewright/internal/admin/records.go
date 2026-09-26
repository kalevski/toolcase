package admin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
)

// handleListRecords lists a zone's records, optionally filtered by ?name=
// (relative or absolute, normalized like a record name) and ?type=.
func (s *Server) handleListRecords(w http.ResponseWriter, r *http.Request) {
	_, z := s.lookupZone(w, r)
	if z == nil {
		return
	}
	q := r.URL.Query()
	name := ""
	if q.Has("name") {
		n, err := config.NormalizeOwner(q.Get("name"), z.Name)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		name = n
	}
	typ := strings.ToUpper(q.Get("type"))
	out := []config.Record{}
	for _, rec := range z.Records {
		if (name == "" || rec.Name == name) && (typ == "" || rec.Type == typ) {
			out = append(out, rec)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"zone": z.Name, "records": out}, s)
}

// existing wraps a record mutation: the zone must exist.
func existing(fn func(z *config.Zone) error) func(manager.Current) (*config.Zone, error) {
	return func(cur manager.Current) (*config.Zone, error) {
		if !cur.Exists {
			return nil, manager.Errorf(http.StatusNotFound, "zone %s not found", cur.Zone.Name)
		}
		z := cur.Zone
		if err := fn(&z); err != nil {
			return nil, err
		}
		return &z, nil
	}
}

// handleAddRecord appends one record. 409 when an identical record exists.
func (s *Server) handleAddRecord(w http.ResponseWriter, r *http.Request) {
	var rec config.Record
	if !decodeJSON(w, r, &rec) {
		return
	}
	s.writeAs(w, r, r.PathValue("zone"), true, existing(func(z *config.Zone) error {
		if err := config.NormalizeRecord(&rec, z.Name); err != nil {
			return manager.Errorf(http.StatusBadRequest, "invalid record: %v", err)
		}
		if err := permitRecord(r, rec.Name, rec.Type); err != nil {
			return err
		}
		for _, cur := range z.Records {
			if cur.Name == rec.Name && cur.Type == rec.Type && cur.RData() == rec.RData() {
				return manager.Errorf(http.StatusConflict, "record %s %s %s already exists", rec.Name, rec.Type, rec.RData())
			}
		}
		z.Records = append(z.Records, rec)
		return nil
	}))
}

// rrsetBody is the PUT body: the complete new content of one RRset. Each
// record's name/type may be omitted (they come from the path) and, if given,
// must match it. An empty list deletes the RRset.
type rrsetBody struct {
	Records []config.Record `json:"records"`
}

// handlePutRRset replaces every record of one name+type — the natural shape
// for dynamic-DNS style updates and ACME DNS-01 TXT challenges.
func (s *Server) handlePutRRset(w http.ResponseWriter, r *http.Request) {
	var body rrsetBody
	if !decodeJSON(w, r, &body) {
		return
	}
	s.write(w, r, r.PathValue("zone"), existing(func(z *config.Zone) error {
		name, typ, err := rrsetKey(r, z.Name)
		if err != nil {
			return err
		}
		if err := permitRecord(r, name, typ); err != nil {
			return err
		}
		for i := range body.Records {
			rec := &body.Records[i]
			if rec.Name == "" {
				rec.Name = name
			}
			if rec.Type == "" {
				rec.Type = typ
			}
			if err := config.NormalizeRecord(rec, z.Name); err != nil {
				return manager.Errorf(http.StatusBadRequest, "records[%d]: %v", i, err)
			}
			if rec.Name != name || rec.Type != typ {
				return manager.Errorf(http.StatusBadRequest, "records[%d] is %s %s, but the path names the %s %s RRset", i, rec.Name, rec.Type, name, typ)
			}
		}
		out := make([]config.Record, 0, len(z.Records)+len(body.Records))
		inserted := false
		for _, cur := range z.Records {
			if cur.Name == name && cur.Type == typ {
				if !inserted {
					out = append(out, body.Records...)
					inserted = true
				}
				continue
			}
			out = append(out, cur)
		}
		if !inserted {
			out = append(out, body.Records...)
		}
		z.Records = out
		return nil
	}))
}

// handleDeleteRRset removes one RRset, or with ?value= only the matching
// records of it. 404 when nothing matched.
func (s *Server) handleDeleteRRset(w http.ResponseWriter, r *http.Request) {
	s.write(w, r, r.PathValue("zone"), existing(func(z *config.Zone) error {
		name, typ, err := rrsetKey(r, z.Name)
		if err != nil {
			return err
		}
		if err := permitRecord(r, name, typ); err != nil {
			return err
		}
		q := r.URL.Query()
		value, hasValue := "", q.Has("value")
		if hasValue {
			v, err := config.NormalizeValue(typ, q.Get("value"))
			if err != nil {
				return manager.Errorf(http.StatusBadRequest, "%v", err)
			}
			value = v
		}
		out := z.Records[:0:0]
		removed := 0
		for _, cur := range z.Records {
			if cur.Name == name && cur.Type == typ && (!hasValue || cur.Value == value) {
				removed++
				continue
			}
			out = append(out, cur)
		}
		if removed == 0 {
			return manager.Errorf(http.StatusNotFound, "no %s %s record matched", name, typ)
		}
		z.Records = out
		return nil
	}))
}

// rrsetKey normalizes the {name}/{type} path values.
func rrsetKey(r *http.Request, zone string) (string, string, error) {
	name, err := config.NormalizeOwner(r.PathValue("name"), zone)
	if err != nil {
		return "", "", manager.Errorf(http.StatusBadRequest, "%v", err)
	}
	typ := strings.ToUpper(r.PathValue("type"))
	for _, t := range config.RecordTypes {
		if t == typ {
			return name, typ, nil
		}
	}
	return "", "", manager.Errorf(http.StatusBadRequest, "%s", fmt.Sprintf("unsupported record type %q", typ))
}

// decodeJSON strictly decodes a size-limited JSON body.
func decodeJSON(w http.ResponseWriter, r *http.Request, out any) bool {
	body, ok := readBody(w, r)
	if !ok {
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}
