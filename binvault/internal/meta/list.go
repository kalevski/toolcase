package meta

import (
	"context"
	"strings"
)

// ListOptions drive ListLatest and ListVersions (spec §5.4.6, §5.4.8).
type ListOptions struct {
	Prefix    string
	Delimiter string
	// After is an exclusive start: only keys > After are returned. For
	// ListVersions, see VersionMarker.
	After string
	// SkipUnder, when set, is a common prefix whose keys are all skipped (the
	// previous page ended on that common prefix).
	SkipUnder string
	// MaxKeys bounds objects + common prefixes (must be > 0).
	MaxKeys int
	// Allow, when non-nil, filters keys the caller may not see (grant patterns).
	Allow func(key string) bool
	// VersionMarker (ListVersions only): resume inside key After, after the
	// version with this seq. 0 = none.
	VersionSeq int64
}

// ListEntry is one object (version) or one common prefix.
type ListEntry struct {
	Obj    *Object
	Prefix string
}

// ListResult is one page.
type ListResult struct {
	Entries   []ListEntry
	Truncated bool
}

// PrefixUpper returns the smallest string greater than every string with the
// given prefix ("" means "no upper bound").
func PrefixUpper(p string) string {
	b := []byte(p)
	for i := len(b) - 1; i >= 0; i-- {
		if b[i] < 0xFF {
			b[i]++
			return string(b[:i+1])
		}
	}
	return ""
}

// after returns the smallest key strictly greater than k.
func after(k string) string { return k + "\x00" }

const listBatch = 256

// ListLatest lists the visible latest version of each key (delete markers hide
// their key), grouped by delimiter.
func (q Q) ListLatest(ctx context.Context, bucket string, o ListOptions) (*ListResult, error) {
	return q.list(ctx, bucket, o, false)
}

// ListVersions lists every version and delete marker: keys ascending, each
// key's versions newest first (by seq).
func (q Q) ListVersions(ctx context.Context, bucket string, o ListOptions) (*ListResult, error) {
	return q.list(ctx, bucket, o, true)
}

func (q Q) list(ctx context.Context, bucket string, o ListOptions, versions bool) (*ListResult, error) {
	res := &ListResult{}
	if o.MaxKeys <= 0 {
		return res, nil
	}
	upper := PrefixUpper(o.Prefix)
	from := o.Prefix
	if o.After != "" && after(o.After) > from {
		from = after(o.After)
	}
	if o.SkipUnder != "" {
		if u := PrefixUpper(o.SkipUnder); u != "" && u > from {
			from = u
		}
	}
	count := 0

	// ListVersions resuming inside a key: finish that key's older versions first.
	if versions && o.VersionSeq > 0 && o.After != "" {
		rows, err := q.q.QueryContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? AND seq < ? ORDER BY seq DESC`,
			bucket, o.After, o.VersionSeq)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			ob, err := scanObject(rows)
			if err != nil {
				rows.Close()
				return nil, err
			}
			if o.Allow != nil && !o.Allow(ob.Key) {
				continue
			}
			if count == o.MaxKeys {
				rows.Close()
				res.Truncated = true
				return res, nil
			}
			res.Entries = append(res.Entries, ListEntry{Obj: ob})
			count++
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}

	where := `bucket=? AND key >= ?`
	if upper != "" {
		where += ` AND key < ?`
	}
	if !versions {
		where += ` AND is_latest=1 AND delete_marker=0`
	}
	order := ` ORDER BY key`
	if versions {
		order = ` ORDER BY key, seq DESC`
	}
	for {
		args := []any{bucket, from}
		if upper != "" {
			args = append(args, upper)
		}
		args = append(args, listBatch)
		rows, err := q.q.QueryContext(ctx, `SELECT `+objCols+` FROM objects WHERE `+where+order+` LIMIT ?`, args...)
		if err != nil {
			return nil, err
		}
		n := 0
		requery := false
		var lastKey string
		for rows.Next() {
			ob, err := scanObject(rows)
			if err != nil {
				rows.Close()
				return nil, err
			}
			n++
			lastKey = ob.Key
			if o.Allow != nil && !o.Allow(ob.Key) {
				from = after(ob.Key)
				if versions {
					// all versions of a hidden key are hidden too
					from = after(ob.Key)
					requery = true
					break
				}
				continue
			}
			if o.Delimiter != "" {
				rest := ob.Key[len(o.Prefix):]
				if idx := strings.Index(rest, o.Delimiter); idx >= 0 {
					cp := o.Prefix + rest[:idx+len(o.Delimiter)]
					if count == o.MaxKeys {
						rows.Close()
						res.Truncated = true
						return res, nil
					}
					res.Entries = append(res.Entries, ListEntry{Prefix: cp})
					count++
					if u := PrefixUpper(cp); u != "" {
						from = u
					} else {
						rows.Close()
						return res, nil
					}
					requery = true
					break
				}
			}
			if count == o.MaxKeys {
				rows.Close()
				res.Truncated = true
				return res, nil
			}
			res.Entries = append(res.Entries, ListEntry{Obj: ob})
			count++
			if !versions {
				from = after(ob.Key)
			}
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
		if requery {
			continue
		}
		if n < listBatch {
			return res, nil
		}
		if versions {
			// continue after the last row of this batch: same key may have more
			// versions, so resume strictly after the last emitted (key, seq)
			last := res.Entries[len(res.Entries)-1]
			if last.Obj != nil && last.Obj.Key == lastKey {
				more, err := q.moreVersions(ctx, bucket, last.Obj, o, &count, res)
				if err != nil {
					return nil, err
				}
				if more {
					return res, nil
				}
			}
			from = after(lastKey)
		}
	}
}

// moreVersions drains the remaining (older) versions of a key at a batch boundary.
// It reports true when the page became full (res.Truncated set).
func (q Q) moreVersions(ctx context.Context, bucket string, last *Object, o ListOptions, count *int, res *ListResult) (bool, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? AND seq < ? ORDER BY seq DESC`, bucket, last.Key, last.Seq)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		ob, err := scanObject(rows)
		if err != nil {
			return false, err
		}
		if *count == o.MaxKeys {
			res.Truncated = true
			return true, nil
		}
		res.Entries = append(res.Entries, ListEntry{Obj: ob})
		*count++
	}
	return false, rows.Err()
}
