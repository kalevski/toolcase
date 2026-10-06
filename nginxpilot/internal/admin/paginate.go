package admin

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
)

const maxPageLimit = 500

// pageParams is the parsed opt-in paging of a list route. paged is false when
// no limit was sent, in which case the route answers exactly as it always did.
type pageParams struct {
	paged   bool
	limit   int
	after   string // exclusive lower bound on the item key; "" = from the start
	summary bool
}

// cursorToken is the decoded `cursor`: "everything after this key". Keys, not
// offsets, so inserts and deletes between pages never skip or repeat an item.
type cursorToken struct {
	After string `json:"after"`
}

// parsePage reads limit / cursor / fields. A bad value is a 400 (plain text,
// like every other admin error) and ok is false. summaryOK says whether the
// route has a summary view; fields=summary elsewhere is a 400, not a silent
// full response.
func parsePage(w http.ResponseWriter, r *http.Request, summaryOK bool) (p pageParams, ok bool) {
	q := r.URL.Query()
	if v := q.Get("fields"); v != "" {
		switch {
		case v == "full":
		case v == "summary" && summaryOK:
			p.summary = true
		default:
			http.Error(w, fmt.Sprintf("invalid fields %q", v), http.StatusBadRequest)
			return p, false
		}
	}
	rawLimit, hasLimit := q["limit"]
	rawCursor := q.Get("cursor")
	if !hasLimit {
		if rawCursor != "" {
			http.Error(w, "cursor requires limit", http.StatusBadRequest)
			return p, false
		}
		return p, true
	}
	n, err := strconv.Atoi(rawLimit[0])
	if err != nil || n < 1 || n > maxPageLimit {
		http.Error(w, fmt.Sprintf("invalid limit %q (want 1-%d)", rawLimit[0], maxPageLimit), http.StatusBadRequest)
		return p, false
	}
	p.paged, p.limit = true, n
	if rawCursor != "" {
		raw, err := base64.RawURLEncoding.DecodeString(rawCursor)
		var tok cursorToken
		if err != nil || json.Unmarshal(raw, &tok) != nil {
			http.Error(w, "invalid cursor", http.StatusBadRequest)
			return p, false
		}
		p.after = tok.After
	}
	return p, true
}

// paginate returns the slice to serialize plus the response envelope it goes
// in. Unpaged, items are returned in config order (never nil, so the list is
// an array not null) and the envelope is empty: the old shape. Paged, items
// are ordered by key, cut after the cursor and limited, and the envelope gains
// next_cursor (null on the last page) and total (all items, not the page).
func paginate[T any](items []T, key func(T) string, p pageParams) ([]T, map[string]any) {
	body := map[string]any{}
	if !p.paged {
		if items == nil {
			items = []T{}
		}
		return items, body
	}
	sorted := make([]T, len(items))
	copy(sorted, items)
	sort.SliceStable(sorted, func(i, j int) bool { return key(sorted[i]) < key(sorted[j]) })
	start := 0
	if p.after != "" {
		start = sort.Search(len(sorted), func(i int) bool { return key(sorted[i]) > p.after })
	}
	end := start + p.limit
	var next any
	if end < len(sorted) {
		raw, _ := json.Marshal(cursorToken{After: key(sorted[end-1])})
		next = base64.RawURLEncoding.EncodeToString(raw)
	} else {
		end = len(sorted)
	}
	body["next_cursor"] = next
	body["total"] = len(sorted)
	return sorted[start:end], body
}
