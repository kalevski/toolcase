package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// Settings are the editable bucket settings (spec §6.3).
type Settings struct {
	QuotaBytes          *int64               `json:"quota_bytes"`
	MaxObjects          *int64               `json:"max_objects"`
	MaxObjectBytes      *int64               `json:"max_object_bytes"`
	AllowedContentTypes []string             `json:"allowed_content_types"`
	Versioning          string               `json:"versioning"`
	Encryption          string               `json:"encryption"`
	Lifecycle           []meta.LifecycleRule `json:"lifecycle"`
	Limits              meta.Limits          `json:"limits"`
	AnonymousRead       string               `json:"anonymous_read"`
	AnonymousPrefixes   []string             `json:"anonymous_prefixes"`
	CORS                []meta.CORSRule      `json:"cors"`
}

func defaultSettings() Settings {
	return Settings{
		AllowedContentTypes: []string{}, Versioning: meta.VersioningOff, Encryption: meta.EncryptionNone,
		Lifecycle: []meta.LifecycleRule{}, AnonymousRead: meta.AnonOff, AnonymousPrefixes: []string{}, CORS: []meta.CORSRule{},
	}
}

func settingsOf(b *meta.Bucket) Settings {
	s := Settings{
		QuotaBytes: b.QuotaBytes, MaxObjects: b.MaxObjects, MaxObjectBytes: b.MaxObjectBytes,
		AllowedContentTypes: nonNil(b.AllowedContentTypes), Versioning: b.Versioning, Encryption: b.Encryption,
		Lifecycle: b.Lifecycle, Limits: b.Limits, AnonymousRead: b.AnonymousRead,
		AnonymousPrefixes: nonNil(b.AnonymousPrefixes), CORS: b.CORS,
	}
	if s.Lifecycle == nil {
		s.Lifecycle = []meta.LifecycleRule{}
	}
	if s.CORS == nil {
		s.CORS = []meta.CORSRule{}
	}
	return s
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func (s Settings) apply(b *meta.Bucket) {
	b.QuotaBytes, b.MaxObjects, b.MaxObjectBytes = s.QuotaBytes, s.MaxObjects, s.MaxObjectBytes
	b.AllowedContentTypes, b.Versioning, b.Encryption = s.AllowedContentTypes, s.Versioning, s.Encryption
	b.Lifecycle, b.Limits, b.AnonymousRead = s.Lifecycle, s.Limits, s.AnonymousRead
	b.AnonymousPrefixes, b.CORS = s.AnonymousPrefixes, s.CORS
}

// bucketJSON is the response representation (spec §6.3).
type bucketJSON struct {
	Name      string    `json:"name"`
	Home      string    `json:"home"`
	CreatedAt time.Time `json:"created_at"`
	Revision  int64     `json:"revision"`
	Settings
	Stats *statsJSON `json:"stats,omitempty"`
}

type statsJSON struct {
	Objects       int64 `json:"objects"`
	Versions      int64 `json:"versions"`
	DeleteMarkers int64 `json:"delete_markers"`
	Bytes         int64 `json:"bytes"`
	UploadBytes   int64 `json:"upload_bytes"`
}

func (s *Server) bucketOut(b *meta.Bucket, stats bool) bucketJSON {
	out := bucketJSON{Name: b.Name, Home: s.NodeName, CreatedAt: b.CreatedAt, Revision: b.Revision, Settings: settingsOf(b)}
	if stats {
		out.Stats = &statsJSON{Objects: b.Objects, Versions: b.Versions, DeleteMarkers: b.DeleteMarkers, Bytes: b.Bytes, UploadBytes: b.UploadBytes}
	}
	return out
}

// ---- validation -------------------------------------------------------------------

func (s *Server) validate(set *Settings) map[string]string {
	f := map[string]string{}
	nonNeg := func(name string, v *int64) {
		if v != nil && *v < 0 {
			f[name] = "must not be negative"
		}
	}
	nonNeg("quota_bytes", set.QuotaBytes)
	nonNeg("max_objects", set.MaxObjects)
	if set.MaxObjectBytes != nil {
		if *set.MaxObjectBytes < 1 {
			f["max_object_bytes"] = "must be at least 1"
		} else if *set.MaxObjectBytes > s.Cfg.MaxObjectBytes() {
			f["max_object_bytes"] = fmt.Sprintf("must not exceed BINVAULT_MAX_OBJECT_MB (%d bytes)", s.Cfg.MaxObjectBytes())
		}
	}
	if err := engine.ValidatePatterns(set.AllowedContentTypes); err != nil {
		f["allowed_content_types"] = apiMessage(err)
	}
	switch set.Versioning {
	case meta.VersioningOff, meta.VersioningEnabled:
	default:
		f["versioning"] = `must be "off" or "enabled"`
	}
	switch set.Encryption {
	case meta.EncryptionNone, meta.EncryptionSSES3:
	default:
		f["encryption"] = `must be "none" or "sse-s3"`
	}
	switch set.AnonymousRead {
	case meta.AnonOff, meta.AnonObjects:
	default:
		f["anonymous_read"] = `must be "off" or "objects"`
	}
	if set.AnonymousRead == meta.AnonOff && len(set.AnonymousPrefixes) > 0 {
		f["anonymous_prefixes"] = `only valid with anonymous_read "objects"`
	}
	l := set.Limits
	if l.RequestsPerSecond < 0 || l.Burst < 0 || l.BytesInPerSecond < 0 || l.BytesOutPerSecond < 0 {
		f["limits"] = "limits must not be negative"
	}
	validateLifecycle(set.Lifecycle, f)
	validateCORS(set.CORS, f)
	return f
}

func validateLifecycle(rules []meta.LifecycleRule, f map[string]string) {
	if len(rules) > 100 {
		f["lifecycle"] = "at most 100 rules"
		return
	}
	seen := map[string]bool{}
	for i, r := range rules {
		at := func(field, msg string) { f[fmt.Sprintf("lifecycle[%d].%s", i, field)] = msg }
		switch {
		case r.ID == "":
			at("id", "must not be empty")
		case len(r.ID) > 255:
			at("id", "too long")
		case seen[r.ID]:
			at("id", "duplicate rule id")
		}
		seen[r.ID] = true
		if r.ExpireDays < 0 || r.NoncurrentDays < 0 || r.NoncurrentKeep < 0 || r.AbortMultipartDays < 0 {
			at("", "day counts must not be negative")
		}
		if r.NoncurrentKeep > 0 && r.NoncurrentDays == 0 {
			at("noncurrent_keep", "requires noncurrent_days")
		}
		if r.ExpireDays == 0 && !r.ExpireDeleteMarkers && r.NoncurrentDays == 0 && r.AbortMultipartDays == 0 {
			at("", "a rule needs at least one action (expire_days, expire_delete_markers, noncurrent_days or abort_multipart_days)")
		}
		if r.Filter.MinSize < 0 || r.Filter.MaxSize < 0 || (r.Filter.MaxSize > 0 && r.Filter.MinSize > r.Filter.MaxSize) {
			at("filter", "invalid min_size / max_size")
		}
		if err := engine.ValidateTags(r.Filter.Tags); err != nil {
			at("filter.tags", apiMessage(err))
		}
	}
}

var corsMethods = map[string]bool{"GET": true, "PUT": true, "POST": true, "DELETE": true, "HEAD": true}

func validateCORS(rules []meta.CORSRule, f map[string]string) {
	if len(rules) > 100 {
		f["cors"] = "at most 100 rules"
		return
	}
	for i, r := range rules {
		at := func(field, msg string) { f[fmt.Sprintf("cors[%d].%s", i, field)] = msg }
		if len(r.AllowedOrigins) == 0 {
			at("allowed_origins", "must not be empty")
		}
		for _, o := range r.AllowedOrigins {
			if o == "" || strings.Count(o, "*") > 1 {
				at("allowed_origins", "origins are non-empty and may contain at most one *")
			}
		}
		if len(r.AllowedMethods) == 0 {
			at("allowed_methods", "must not be empty")
		}
		for _, m := range r.AllowedMethods {
			if !corsMethods[strings.ToUpper(m)] {
				at("allowed_methods", fmt.Sprintf("unsupported method %q", m))
			}
		}
		if r.MaxAgeSeconds < 0 {
			at("max_age_seconds", "must not be negative")
		}
	}
}

// ---- merge patch (RFC 7396) -----------------------------------------------------

func mergePatch(target map[string]any, patch map[string]any) {
	for k, v := range patch {
		if v == nil {
			delete(target, k)
			continue
		}
		if pm, ok := v.(map[string]any); ok {
			tm, _ := target[k].(map[string]any)
			if tm == nil {
				tm = map[string]any{}
			}
			mergePatch(tm, pm)
			target[k] = tm
			continue
		}
		target[k] = v
	}
}

// ---- routes -----------------------------------------------------------------------

func (s *Server) routeBuckets(rc *Ctx) error {
	segs, m := rc.Segs, rc.R.Method
	info := httpx.From(rc.Ctx)
	// a change to a bucket that is frozen or paused for a move is refused (spec §8.8);
	// the move request itself is the one call that is not
	if len(segs) >= 2 && m != http.MethodGet && m != http.MethodHead && m != http.MethodOptions && !(len(segs) == 3 && segs[2] == "move") {
		ctx, end, err := rc.GateWrite(segs[1])
		if err != nil {
			return err
		}
		defer end()
		rc.Ctx = ctx
	}
	switch {
	case len(segs) == 1 && m == http.MethodPost:
		info.Op = "AdminCreateBucket"
		return s.createBucket(rc)
	case len(segs) == 1 && m == http.MethodGet:
		info.Op = "AdminListBuckets"
		return s.listBuckets(rc)
	case len(segs) == 2:
		info.Bucket = segs[1]
		switch m {
		case http.MethodGet:
			info.Op = "AdminGetBucket"
			return s.getBucket(rc, segs[1])
		case http.MethodPut:
			info.Op = "AdminPutBucket"
			return s.updateBucket(rc, segs[1], false)
		case http.MethodPatch:
			info.Op = "AdminPatchBucket"
			return s.updateBucket(rc, segs[1], true)
		case http.MethodDelete:
			info.Op = "AdminDeleteBucket"
			return s.deleteBucket(rc, segs[1])
		}
	case len(segs) == 3 && segs[2] == "move" && m == http.MethodPost:
		info.Bucket = segs[1]
		return s.routeMoves(rc)
	case len(segs) >= 3 && segs[2] == "tokens":
		info.Bucket = segs[1]
		return s.routeTokens(rc)
	}
	if s.Extra != nil {
		if handled, err := s.Extra(rc); handled || err != nil {
			return err
		}
	}
	return notFound("no such admin endpoint")
}

type createBody struct {
	Name string `json:"name"`
	Home string `json:"home"`
	Settings
}

func (s *Server) checkHome(home string) error {
	switch home {
	case "", "auto", s.NodeName:
		return nil
	}
	return invalid("unknown home node", map[string]string{"home": fmt.Sprintf("%q is not a node of this deployment", home)})
}

func (s *Server) createBucket(rc *Ctx) error {
	body := createBody{Settings: defaultSettings()}
	if err := rc.Decode(&body); err != nil {
		return err
	}
	if err := engine.ValidateBucketName(body.Name, s.Cfg.Domain != ""); err != nil {
		return invalid("invalid bucket name", map[string]string{"name": apiMessage(err)})
	}
	if err := s.checkHome(body.Home); err != nil {
		return err
	}
	set := body.Settings
	if f := s.validate(&set); len(f) > 0 {
		return invalid("invalid bucket settings", f)
	}
	b := &meta.Bucket{Name: body.Name, Generation: ulid.New()}
	set.apply(b)
	if err := s.clusterCanCreate(body.Name); err != nil {
		return err
	}
	err := s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error {
		if err := tx.CreateBucket(rc.Ctx, b); err != nil {
			return err
		}
		if s.Cluster == nil {
			return nil
		}
		// until the catalog entry is written the bucket is "to be published": a crash
		// in between is repaired at the next start (and only then: a bucket the
		// catalog does not list otherwise is an orphan, spec §8.5)
		return tx.KVSet(rc.Ctx, meta.PublishPendingKey(b.Name), b.Generation)
	})
	if errors.Is(err, meta.ErrExists) {
		return s.existsErr(rc, body.Name)
	}
	if err != nil {
		return internalErr(err)
	}
	cur, err := s.Eng.Bucket(rc.Ctx, body.Name)
	if err != nil {
		return internalErr(err)
	}
	if set.Encryption == meta.EncryptionSSES3 {
		if _, err := s.Eng.BucketKey(rc.Ctx, cur); err != nil {
			s.rollbackBucket(rc, cur)
			return internalErr(err)
		}
	}
	if err := s.publishBucket(rc, cur); err != nil {
		return err
	}
	s.changed(cur)
	rc.WriteReplicated(http.StatusCreated, s.bucketDetail(rc, cur))
	return nil
}

func (s *Server) changed(b *meta.Bucket) {
	if s.OnBucketChanged != nil {
		s.OnBucketChanged(b)
	}
}

func (s *Server) listBuckets(rc *Ctx) error {
	limit, cursor, err := PageParams(rc.R)
	if err != nil {
		return err
	}
	stats := rc.R.URL.Query().Get("stats") == "true"
	bs, err := s.Eng.DB.Read().ListBuckets(rc.Ctx, cursor, limit+1)
	if err != nil {
		return internalErr(err)
	}
	var next any
	if len(bs) > limit {
		bs = bs[:limit]
		next = bs[len(bs)-1].Name
	}
	items := make([]bucketJSON, len(bs))
	for i, b := range bs {
		items[i] = s.bucketOut(b, stats)
	}
	WriteJSON(rc.W, http.StatusOK, map[string]any{"items": items, "next_cursor": next})
	return nil
}

// bucketDetail is a bucket as the calls on a single bucket answer it: with its
// attached pipelines (an empty list, not a missing field, when none is attached).
func (s *Server) bucketDetail(rc *Ctx, b *meta.Bucket) any {
	out := struct {
		bucketJSON
		Pipelines []any `json:"pipelines"`
	}{bucketJSON: s.bucketOut(b, true), Pipelines: []any{}}
	if s.PipelinesOf != nil {
		if ps := s.PipelinesOf(rc.Ctx, b.Name); ps != nil {
			out.Pipelines = ps
		}
	}
	return out
}

func (s *Server) getBucket(rc *Ctx, name string) error {
	b, err := s.Eng.DB.Read().GetBucket(rc.Ctx, name)
	if err != nil {
		return notFoundBucket(err, name)
	}
	WriteJSON(rc.W, http.StatusOK, s.bucketDetail(rc, b))
	return nil
}

func notFoundBucket(err error, name string) error {
	if errors.Is(err, meta.ErrNotFound) {
		return notFound(fmt.Sprintf("bucket %q does not exist", name))
	}
	return internalErr(err)
}

// updateBucket implements PUT (replace) and PATCH (merge patch).
func (s *Server) updateBucket(rc *Ctx, name string, patch bool) error {
	rev, err := ifMatch(rc.R)
	if err != nil {
		return err
	}
	raw, err := rc.ReadBody()
	if err != nil {
		return err
	}
	var set Settings
	var bodyName, bodyHome string
	cur, err := s.Eng.DB.Read().GetBucket(rc.Ctx, name)
	if err != nil {
		return notFoundBucket(err, name)
	}
	if patch {
		var patchMap map[string]any
		if err := json.Unmarshal(raw, &patchMap); err != nil {
			return invalid("invalid JSON body: "+err.Error(), nil)
		}
		if v, ok := patchMap["name"].(string); ok {
			bodyName = v
		}
		if v, ok := patchMap["home"].(string); ok {
			bodyHome = v
		}
		delete(patchMap, "name")
		delete(patchMap, "home")
		base, _ := json.Marshal(settingsOf(cur))
		var target map[string]any
		_ = json.Unmarshal(base, &target)
		mergePatch(target, patchMap)
		merged, _ := json.Marshal(target)
		set = defaultSettings()
		if err := DecodeStrict(merged, &set); err != nil {
			return err
		}
	} else {
		body := createBody{Settings: defaultSettings()}
		if err := DecodeStrict(raw, &body); err != nil {
			return err
		}
		set, bodyName, bodyHome = body.Settings, body.Name, body.Home
	}
	if bodyName != "" && bodyName != name {
		return invalid("the bucket name is immutable", map[string]string{"name": "cannot be changed"})
	}
	if err := s.checkHome(bodyHome); err != nil {
		return err
	}
	if f := s.validate(&set); len(f) > 0 {
		return invalid("invalid bucket settings", f)
	}
	if cur.Versioning == meta.VersioningEnabled && set.Versioning == meta.VersioningOff {
		return conflict(`versioning cannot go back from "enabled" to "off"`)
	}
	updated := *cur
	set.apply(&updated)
	if equalSettings(settingsOf(cur), set) {
		// identical settings change nothing, the revision included, with or without
		// If-Match (which still decides between 200 and 412; spec §6.3)
		if rev != 0 && rev != cur.Revision {
			return precondition("the bucket was changed by someone else; read it again")
		}
		WriteJSON(rc.W, http.StatusOK, s.bucketDetail(rc, cur))
		return nil
	}
	err = s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error { return tx.UpdateBucketSettings(rc.Ctx, &updated, rev) })
	switch {
	case errors.Is(err, meta.ErrConflict):
		return precondition("the bucket was changed by someone else; read it again")
	case errors.Is(err, meta.ErrNotFound):
		return notFound(fmt.Sprintf("bucket %q does not exist", name))
	case err != nil:
		return internalErr(err)
	}
	fresh, err := s.Eng.Bucket(rc.Ctx, name)
	if err != nil {
		return internalErr(err)
	}
	if set.Encryption == meta.EncryptionSSES3 {
		if _, err := s.Eng.BucketKey(rc.Ctx, fresh); err != nil {
			return internalErr(err)
		}
	}
	s.changed(fresh)
	WriteJSON(rc.W, http.StatusOK, s.bucketDetail(rc, fresh))
	return nil
}

func equalSettings(a, b Settings) bool {
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return bytes.Equal(x, y)
}

func (s *Server) deleteBucket(rc *Ctx, name string) error {
	force := rc.R.URL.Query().Get("force") == "true"
	if s.Cluster != nil {
		// the catalog gives the bucket to this node but the node holds no data for
		// that incarnation (it was restored from an older backup, or lost its disk):
		// what is left to delete is the catalog entry (spec §8.9)
		if rec, ok := s.Cluster.Bucket(name); ok && rec.Home == s.Cluster.ID() {
			b, err := s.Eng.DB.Read().GetBucket(rc.Ctx, name)
			if errors.Is(err, meta.ErrNotFound) || (err == nil && b.Generation != rec.Generation) {
				return s.dropLostBucket(rc, name)
			}
		}
	}
	var uploadsToClean, tokenIDs []string
	err := s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error {
		uploadsToClean, tokenIDs = nil, nil
		b, err := tx.GetBucket(rc.Ctx, name)
		if err != nil {
			return err
		}
		if err := s.clusterHomes(name, b); err != nil {
			return err
		}
		if s.Cluster != nil {
			ts, err := tx.ListTokens(rc.Ctx, name, "", 1_000_000)
			if err != nil {
				return err
			}
			for _, t := range ts {
				tokenIDs = append(tokenIDs, t.AccessKeyID)
			}
		}
		if !force {
			empty, err := tx.BucketIsEmpty(rc.Ctx, name)
			if err != nil {
				return err
			}
			if !empty || b.Versions > 0 {
				return errBucketNotEmpty
			}
			if n, _ := tx.CountOpenUploads(rc.Ctx, name); n > 0 {
				return errBucketNotEmpty
			}
		}
		us, _ := tx.ListUploads(rc.Ctx, name, "", "", "", 1_000_000)
		for _, u := range us {
			uploadsToClean = append(uploadsToClean, u.UploadID)
		}
		if err := tx.ReleaseBucketBlobs(rc.Ctx, name); err != nil {
			return err
		}
		if s.OnBucketDeleteTx != nil {
			if err := s.OnBucketDeleteTx(rc.Ctx, tx, name); err != nil {
				return err
			}
		}
		return tx.DeleteBucket(rc.Ctx, name)
	})
	switch {
	case errors.Is(err, errBucketNotEmpty):
		return conflict("the bucket still holds objects, versions, delete markers or open uploads; use ?force=true to delete everything")
	case errors.Is(err, meta.ErrNotFound):
		return notFound(fmt.Sprintf("bucket %q does not exist", name))
	case err != nil:
		return clusterErr(err)
	}
	for _, id := range uploadsToClean {
		_ = s.Eng.Store.RemoveUpload(id)
	}
	s.Tokens.InvalidateBucket(name)
	if s.OnBucketDeleted != nil {
		s.OnBucketDeleted(name)
	}
	if err := s.unpublishBucket(rc, name, tokenIDs); err != nil {
		return err
	}
	rc.WriteReplicated(http.StatusNoContent, nil)
	return nil
}

var errBucketNotEmpty = errors.New("bucket not empty")

var _ = context.Background
