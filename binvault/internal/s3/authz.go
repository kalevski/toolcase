package s3

import (
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
)

func accessDenied(msg string) *apierr.Error { return apierr.New("AccessDenied", msg) }

// need requires the action on the key.
func (rc *reqCtx) need(action, key string) error {
	if rc.p.Kind == auth.KindAnonymous {
		return accessDenied("Anonymous access is not allowed for this operation.")
	}
	if rc.p.Grants.Can(action, key) {
		return nil
	}
	return accessDenied("This credential is not allowed to " + action + " this resource.")
}

// needAnyAction is the rule for bucket-level calls: any action on the bucket
// (spec §4.4).
func (rc *reqCtx) needAnyAction() error {
	if rc.p.Kind == auth.KindAnonymous || !rc.p.Grants.CanAnyAction() {
		return accessDenied("This credential has no access to this bucket.")
	}
	return nil
}

// writeAccess decides how a token may write a key: with `write` it may
// overwrite; with only `create` it is bound by the write-once rule; otherwise
// it is refused (spec §4.4). needTags adds the `tag` requirement.
func (rc *reqCtx) writeAccess(key string, withTags bool) (writeOnce bool, err error) {
	if rc.p.Kind == auth.KindAnonymous {
		return false, accessDenied("Anonymous access is not allowed for this operation.")
	}
	if rc.isBeforeToken() {
		// every write path other than the staged PUT would commit unvetted bytes
		// in the middle of the chain (spec §7.8)
		return false, accessDenied("A before pipeline's token may only replace the staged object.")
	}
	g := rc.p.Grants
	switch {
	case g.Can(auth.Write, key):
		writeOnce = false
	case g.Can(auth.Create, key):
		writeOnce = true
	default:
		return false, accessDenied("This credential is not allowed to write this key.")
	}
	if withTags && !g.Can(auth.Tag, key) {
		return false, accessDenied("This credential is not allowed to tag objects.")
	}
	return writeOnce, nil
}

// anonymousRead reports whether an anonymous GET/HEAD of key is allowed by the
// bucket's setting (spec §4.6).
func (rc *reqCtx) anonymousRead(key string) bool {
	b := rc.b
	if b.AnonymousRead != "objects" {
		return false
	}
	if len(b.AnonymousPrefixes) == 0 {
		return true
	}
	for _, p := range b.AnonymousPrefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	return false
}
