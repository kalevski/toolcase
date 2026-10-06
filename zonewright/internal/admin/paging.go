package admin

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
)

// maxPageLimit is the largest ?limit= a list route accepts.
const maxPageLimit = 500

// pageReq is the opt-in paging of a list route: ?limit=1..500 and ?cursor=.
// The zero value (neither given) means "everything", the pre-paging shape.
type pageReq struct {
	limit  int      // 0 = no limit
	after  []string // sort key of the last item of the previous page
	active bool     // limit or cursor was given
}

// parsePage reads ?limit= and ?cursor=. keyLen is the number of parts in the
// route's sort key; a cursor with another arity is rejected.
func parsePage(q url.Values, keyLen int) (pageReq, error) {
	var p pageReq
	if q.Has("limit") {
		n, err := strconv.Atoi(q.Get("limit"))
		if err != nil || n < 1 || n > maxPageLimit {
			return p, fmt.Errorf("limit must be an integer from 1 to %d", maxPageLimit)
		}
		p.limit, p.active = n, true
	}
	if q.Has("cursor") {
		after, err := decodeCursor(q.Get("cursor"), keyLen)
		if err != nil {
			return p, err
		}
		p.after, p.active = after, true
	}
	return p, nil
}

// cursorBody is the decoded cursor: "everything after this sort key".
type cursorBody struct {
	After []string `json:"after"`
}

func encodeCursor(key []string) string {
	b, _ := json.Marshal(cursorBody{After: key})
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(s string, keyLen int) ([]string, error) {
	errBad := errors.New("invalid cursor")
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, errBad
	}
	var c cursorBody
	if err := json.Unmarshal(raw, &c); err != nil || len(c.After) != keyLen {
		return nil, errBad
	}
	return c.After, nil
}

func cmpKey(a, b []string) int {
	for i := range a {
		if c := strings.Compare(a[i], b[i]); c != 0 {
			return c
		}
	}
	return 0
}

// paginate orders items by key, drops those at or before the cursor and cuts
// one page. total counts every item, whatever the cursor; next is the cursor
// for the following page, "" on the last. Because a cursor is a key and not
// an offset, items inserted or removed between pages never shift the page.
func paginate[T any](items []T, key func(T) []string, p pageReq) (page []T, next string, total int) {
	items = slices.Clone(items)
	slices.SortStableFunc(items, func(a, b T) int { return cmpKey(key(a), key(b)) })
	total = len(items)
	if p.after != nil {
		i, _ := slices.BinarySearchFunc(items, p.after, func(it T, k []string) int {
			if c := cmpKey(key(it), k); c != 0 {
				return c
			}
			return -1 // equal keys sort before "after": skip them
		})
		items = items[i:]
	}
	if p.limit > 0 && len(items) > p.limit {
		items = items[:p.limit]
		next = encodeCursor(key(items[len(items)-1]))
	}
	return items, next, total
}

// pageFields adds next_cursor (null on the last page) and total to a
// response body.
func pageFields(resp map[string]any, next string, total int) {
	if next == "" {
		resp["next_cursor"] = nil
	} else {
		resp["next_cursor"] = next
	}
	resp["total"] = total
}

// badPage answers a malformed paging parameter.
func badPage(w http.ResponseWriter, err error) { writeError(w, http.StatusBadRequest, err.Error()) }
