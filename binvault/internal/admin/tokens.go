package admin

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// MaxTokensPerBucket is the cap of spec §3.8.
const MaxTokensPerBucket = 1000

type tokenJSON struct {
	AccessKeyID string       `json:"access_key_id"`
	Name        string       `json:"name"`
	Grants      []meta.Grant `json:"grants"`
	Limits      meta.Limits  `json:"limits"`
	ExpiresAt   *time.Time   `json:"expires_at"`
	CreatedAt   time.Time    `json:"created_at"`
	LastUsedAt  *time.Time   `json:"last_used_at"`
	Revision    int64        `json:"revision"`
	Secret      string       `json:"secret_access_key,omitempty"`
}

func tokenOut(t *meta.Token, secret string) tokenJSON {
	return tokenJSON{AccessKeyID: t.AccessKeyID, Name: t.Name, Grants: t.Grants, Limits: t.Limits, ExpiresAt: WireTimePtr(t.ExpiresAt),
		CreatedAt: WireTime(t.CreatedAt), LastUsedAt: WireTimePtr(t.LastUsedAt), Revision: t.Revision, Secret: secret}
}

// wireTime is a timestamp as the API shows it everywhere: UTC with millisecond
// precision, which is what the database keeps, so that the response to a create
// agrees with the list (spec §6.1). Without it the create answered with the client's
// own offset and the clock's microseconds.
func WireTime(t time.Time) time.Time { return time.UnixMilli(t.UnixMilli()).UTC() }

// WireTimePtr is WireTime for an optional timestamp.
func WireTimePtr(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	v := WireTime(*t)
	return &v
}

type tokenBody struct {
	Name      string       `json:"name"`
	Grants    []meta.Grant `json:"grants"`
	Limits    meta.Limits  `json:"limits"`
	ExpiresAt *time.Time   `json:"expires_at"`
}

func (b *tokenBody) validate() map[string]string {
	f := map[string]string{}
	if b.Name == "" {
		f["name"] = "must not be empty"
	} else if len(b.Name) > 200 {
		f["name"] = "too long"
	}
	if _, err := auth.CompileGrants(b.Grants); err != nil {
		f["grants"] = strings.ReplaceAll(err.Error(), "keypat: ", "") // the package that parsed the pattern is not the client's business
	}
	l := b.Limits
	if l.RequestsPerSecond < 0 || l.Burst < 0 || l.BytesInPerSecond < 0 || l.BytesOutPerSecond < 0 {
		f["limits"] = "limits must not be negative"
	}
	return f
}

func (s *Server) routeTokens(rc *Ctx) error {
	segs, m := rc.Segs, rc.R.Method
	info := httpx.From(rc.Ctx)
	bucket := segs[1]
	switch {
	case len(segs) == 3 && m == http.MethodPost:
		info.Op = "AdminCreateToken"
		return s.createToken(rc, bucket)
	case len(segs) == 3 && m == http.MethodGet:
		info.Op = "AdminListTokens"
		return s.listTokens(rc, bucket)
	case len(segs) == 4 && m == http.MethodPatch:
		info.Op = "AdminPatchToken"
		return s.patchToken(rc, bucket, segs[3])
	case len(segs) == 4 && m == http.MethodDelete:
		info.Op = "AdminDeleteToken"
		return s.deleteToken(rc, bucket, segs[3])
	case len(segs) == 4 && m == http.MethodGet:
		info.Op = "AdminGetToken"
		return s.getToken(rc, bucket, segs[3])
	}
	return notFound("no such admin endpoint")
}

func (s *Server) createToken(rc *Ctx, bucket string) error {
	var body tokenBody
	if err := rc.Decode(&body); err != nil {
		return err
	}
	if f := body.validate(); len(f) > 0 {
		return invalid("invalid token", f)
	}
	if body.ExpiresAt != nil && !body.ExpiresAt.After(time.Now()) {
		return invalid("invalid token", map[string]string{"expires_at": "must be in the future"})
	}
	id, secret := auth.NewAccessKeyID(auth.BucketKeyPrefix), auth.NewSecret()
	sealed, err := s.Tokens.SealSecret(id, secret)
	if err != nil {
		return internalErr(err)
	}
	tok := &meta.Token{AccessKeyID: id, Bucket: bucket, Name: body.Name, Secret: sealed, Grants: body.Grants, Limits: body.Limits, ExpiresAt: body.ExpiresAt}
	err = s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error {
		b, err := tx.GetBucket(rc.Ctx, bucket)
		if err != nil {
			return err
		}
		if err := s.clusterHomes(bucket, b); err != nil {
			return err
		}
		n, err := tx.CountTokens(rc.Ctx, bucket)
		if err != nil {
			return err
		}
		if n >= MaxTokensPerBucket {
			return errTooManyTokens
		}
		return tx.CreateToken(rc.Ctx, tok)
	})
	switch {
	case errors.Is(err, meta.ErrNotFound):
		return notFound(fmt.Sprintf("bucket %q does not exist", bucket))
	case errors.Is(err, errTooManyTokens):
		return conflict(fmt.Sprintf("a bucket holds at most %d tokens", MaxTokensPerBucket))
	case err != nil:
		return clusterErr(err)
	}
	if err := s.publishToken(rc, tok); err != nil {
		return err
	}
	WriteJSON(rc.W, http.StatusCreated, tokenOut(tok, secret))
	return nil
}

var errTooManyTokens = errors.New("too many tokens")

func (s *Server) listTokens(rc *Ctx, bucket string) error {
	limit, cursor, err := PageParams(rc.R)
	if err != nil {
		return err
	}
	if _, err := s.Eng.DB.Read().GetBucket(rc.Ctx, bucket); err != nil {
		return notFoundBucket(err, bucket)
	}
	ts, err := s.Eng.DB.Read().ListTokens(rc.Ctx, bucket, cursor, limit+1)
	if err != nil {
		return internalErr(err)
	}
	var next any
	if len(ts) > limit {
		ts = ts[:limit]
		next = ts[len(ts)-1].AccessKeyID
	}
	items := make([]tokenJSON, len(ts))
	for i, t := range ts {
		items[i] = tokenOut(t, "")
	}
	WriteJSON(rc.W, http.StatusOK, map[string]any{"items": items, "next_cursor": next})
	return nil
}

func (s *Server) loadToken(rc *Ctx, bucket, id string) (*meta.Token, error) {
	t, err := s.Eng.DB.Read().GetToken(rc.Ctx, id)
	if err != nil || t.Bucket != bucket {
		if err == nil || errors.Is(err, meta.ErrNotFound) {
			return nil, notFound(fmt.Sprintf("token %q does not exist in bucket %q", id, bucket))
		}
		return nil, internalErr(err)
	}
	return t, nil
}

func (s *Server) getToken(rc *Ctx, bucket, id string) error {
	t, err := s.loadToken(rc, bucket, id)
	if err != nil {
		return err
	}
	WriteJSON(rc.W, http.StatusOK, tokenOut(t, ""))
	return nil
}

func (s *Server) patchToken(rc *Ctx, bucket, id string) error {
	rev, err := ifMatch(rc.R)
	if err != nil {
		return err
	}
	cur, err := s.loadToken(rc, bucket, id)
	if err != nil {
		return err
	}
	var patchMap map[string]any
	if err := rc.Decode(&patchMap); err != nil {
		return err
	}
	for k := range patchMap {
		switch k {
		case "name", "grants", "limits", "expires_at":
		default:
			return invalid("invalid JSON body", map[string]string{k: "unknown or immutable field"})
		}
	}
	base, _ := json.Marshal(tokenBody{Name: cur.Name, Grants: cur.Grants, Limits: cur.Limits, ExpiresAt: cur.ExpiresAt})
	var target map[string]any
	_ = json.Unmarshal(base, &target)
	mergePatch(target, patchMap)
	merged, _ := json.Marshal(target)
	var body tokenBody
	if err := DecodeStrict(merged, &body); err != nil {
		return err
	}
	if f := body.validate(); len(f) > 0 {
		return invalid("invalid token", f)
	}
	// like a create: an expiry that is part of this change must lie ahead (an expired
	// token whose name is edited keeps the expiry it has)
	if _, set := patchMap["expires_at"]; set && body.ExpiresAt != nil && !body.ExpiresAt.After(time.Now()) {
		return invalid("invalid token", map[string]string{"expires_at": "must be in the future"})
	}
	updated := *cur
	updated.Name, updated.Grants, updated.Limits, updated.ExpiresAt = body.Name, body.Grants, body.Limits, body.ExpiresAt
	err = s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error { return tx.UpdateToken(rc.Ctx, &updated, rev) })
	switch {
	case errors.Is(err, meta.ErrConflict):
		return precondition("the token was changed by someone else; read it again")
	case errors.Is(err, meta.ErrNotFound):
		return notFound("token does not exist")
	case err != nil:
		return internalErr(err)
	}
	s.Tokens.Invalidate(id) // the new grants apply to the very next request
	fresh, err := s.loadToken(rc, bucket, id)
	if err != nil {
		return err
	}
	WriteJSON(rc.W, http.StatusOK, tokenOut(fresh, ""))
	return nil
}

func (s *Server) deleteToken(rc *Ctx, bucket, id string) error {
	if _, err := s.loadToken(rc, bucket, id); err != nil {
		return err
	}
	if err := s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error { return tx.DeleteToken(rc.Ctx, id) }); err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return notFound("token does not exist")
		}
		return internalErr(err)
	}
	// revocation is immediate: drop the cached credential and signing keys
	s.Tokens.Invalidate(id)
	if s.KeyCache != nil {
		s.KeyCache.Invalidate(id)
	}
	s.unpublishToken(rc, id)
	rc.W.WriteHeader(http.StatusNoContent)
	return nil
}
