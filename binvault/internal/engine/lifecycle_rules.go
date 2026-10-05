package engine

import (
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// RuleMatches reports whether a lifecycle rule's filter selects the object:
// every present condition must hold (spec §3.12).
func RuleMatches(r *meta.LifecycleRule, o *meta.Object) bool {
	f := r.Filter
	if f.Prefix != "" && !strings.HasPrefix(o.Key, f.Prefix) {
		return false
	}
	for k, v := range f.Tags {
		if got, ok := o.Tags[k]; !ok || got != v {
			return false
		}
	}
	if f.MinSize > 0 && o.Size < f.MinSize {
		return false
	}
	if f.MaxSize > 0 && o.Size > f.MaxSize {
		return false
	}
	return true
}

// Day is a lifecycle day: 24 hours from the version's timestamp, not rounded to
// midnight UTC (spec §3.12).
const Day = 24 * time.Hour

// Expiry returns when the current data version expires: the earliest
// expire_days expiry among the enabled rules that match it.
func Expiry(rules []meta.LifecycleRule, o *meta.Object) (at time.Time, ruleID string, ok bool) {
	for i := range rules {
		r := &rules[i]
		if !r.IsEnabled() || r.ExpireDays <= 0 || !RuleMatches(r, o) {
			continue
		}
		t := o.CreatedAt.Add(time.Duration(r.ExpireDays) * Day)
		if !ok || t.Before(at) {
			at, ruleID, ok = t, r.ID, true
		}
	}
	return
}
