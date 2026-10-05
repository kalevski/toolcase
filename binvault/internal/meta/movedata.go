package meta

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"
	"unicode/utf8"
)

// The rows of a bucket for a move (spec §8.8 steps 4 and 6): ExportBucket
// writes every row that belongs to the bucket as one stream of JSON lines,
// ImportBucket inserts such a stream on the new home, DiscardBucket removes a
// bucket's rows without any trace in the catalog.
//
// The stream is: for each table a header line {"t":"objects","c":[columns]}
// followed by one line [values] per row, then {"end":{"objects":n,...}} with the
// number of rows of every table. A blob value is {"b":"base64"}; so is a text
// value that is not valid UTF-8 (a key or a metadata value is whatever bytes the
// client sent), as {"s":"base64"}: a JSON string cannot carry it.

// Counts is a number of rows per table.
type Counts map[string]int64

// ErrMoveData is returned for a stream that cannot be imported.
var ErrMoveData = errors.New("meta: invalid bucket data")

type moveTable struct {
	name  string
	query string   // SELECT ... WHERE the bucket's rows; one argument: the bucket
	skip  []string // columns that are not inserted (the new home assigns them)
	remap string   // an integer column renumbered from the new home's counter
}

// moveTables are in insertion order: the tables a bucket's rows reference come first.
var moveTables = []moveTable{
	{name: "buckets", query: `SELECT * FROM buckets WHERE name=?`},
	{name: "blobs", query: `SELECT * FROM blobs WHERE bucket=? AND refs>0`},
	{name: "objects", query: `SELECT * FROM objects WHERE bucket=? ORDER BY seq`, skip: []string{"seq"}},
	{name: "uploads", query: `SELECT * FROM uploads WHERE bucket=? ORDER BY upload_id`},
	{name: "parts", query: `SELECT p.* FROM parts p JOIN uploads u ON u.upload_id=p.upload_id WHERE u.bucket=? ORDER BY p.upload_id, p.number`},
	{name: "tokens", query: `SELECT * FROM tokens WHERE bucket=? ORDER BY access_key_id`},
	{name: "attachments", query: `SELECT * FROM attachments WHERE bucket=? ORDER BY position`},
	{name: "runs", query: `SELECT * FROM runs WHERE bucket=? ORDER BY group_seq, step, id`, remap: "group_seq"},
	{name: "backfills", query: `SELECT * FROM backfills WHERE bucket=? ORDER BY id`},
}

func moveTableByName(name string) (moveTable, bool) {
	for _, t := range moveTables {
		if t.name == name {
			return t, true
		}
	}
	return moveTable{}, false
}

// ExportBucket streams the bucket's rows, read from one consistent snapshot, and
// returns how many rows of each table it wrote.
func (d *DB) ExportBucket(ctx context.Context, bucket string, w io.Writer) (Counts, error) {
	counts := Counts{}
	bw := bufio.NewWriterSize(w, 256<<10)
	err := d.ReadTx(ctx, func(q Q) error {
		for _, t := range moveTables {
			n, err := exportTable(ctx, q, t, bucket, bw)
			if err != nil {
				return fmt.Errorf("meta: exporting %s: %w", t.name, err)
			}
			counts[t.name] = n
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	end, _ := json.Marshal(map[string]Counts{"end": counts})
	if _, err := bw.Write(append(end, '\n')); err != nil {
		return nil, err
	}
	return counts, bw.Flush()
}

func exportTable(ctx context.Context, q Q, t moveTable, bucket string, w *bufio.Writer) (int64, error) {
	rows, err := q.q.QueryContext(ctx, t.query, bucket)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return 0, err
	}
	head, _ := json.Marshal(map[string]any{"t": t.name, "c": cols})
	if _, err := w.Write(append(head, '\n')); err != nil {
		return 0, err
	}
	vals := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	var n int64
	var line bytes.Buffer
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return n, err
		}
		line.Reset()
		line.WriteByte('[')
		for i, v := range vals {
			if i > 0 {
				line.WriteByte(',')
			}
			if err := encodeCell(&line, v); err != nil {
				return n, fmt.Errorf("column %s: %w", cols[i], err)
			}
		}
		line.WriteString("]\n")
		if _, err := w.Write(line.Bytes()); err != nil {
			return n, err
		}
		n++
	}
	return n, rows.Err()
}

func encodeCell(b *bytes.Buffer, v any) error {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case int64:
		fmt.Fprintf(b, "%d", x)
	case bool:
		if x {
			b.WriteString("1")
		} else {
			b.WriteString("0")
		}
	case string:
		if !utf8.ValidString(x) {
			// a JSON string would turn the invalid bytes into U+FFFD: the row would arrive
			// with another key than the one the client wrote (or not at all)
			b.WriteString(`{"s":"`)
			b.WriteString(base64.StdEncoding.EncodeToString([]byte(x)))
			b.WriteString(`"}`)
			break
		}
		raw, _ := json.Marshal(x)
		b.Write(raw)
	case []byte:
		b.WriteString(`{"b":"`)
		b.WriteString(base64.StdEncoding.EncodeToString(x))
		b.WriteString(`"}`)
	default:
		return fmt.Errorf("unsupported value of type %T", v)
	}
	return nil
}

// ImportBucket inserts a stream written by ExportBucket in this transaction. The
// new home's own numbering continues past what it holds: version rows get new
// `seq` values in the order they had, run groups new `group_seq` values; blob
// reference counts are rebuilt from the version rows. It fails with ErrExists if
// the bucket exists, and with ErrMoveData if the stream is damaged or its row
// counts do not match what was inserted. Runs that were running are queued again.
func (t *Tx) ImportBucket(ctx context.Context, r io.Reader) (Counts, error) {
	return t.ImportBucketWith(ctx, r, ImportOptions{})
}

// ImportOptions tune ImportBucketWith.
type ImportOptions struct {
	// Placed says the blob rows of the bucket were created beforehand, one for every
	// blob file the new home received (InsertPlacedBlob): the stream's blob rows then
	// update them instead of being inserted, and a blob row that has no received
	// file of the same size is an error — a version row would reference a blob the
	// sender never sent.
	Placed bool
}

// ImportBucketWith is ImportBucket with options.
func (t *Tx) ImportBucketWith(ctx context.Context, r io.Reader, opt ImportOptions) (Counts, error) {
	imp := &importer{t: t, ctx: ctx, got: Counts{}, groups: map[int64]int64{}, placed: opt.Placed}
	defer imp.closeStmt()
	br := bufio.NewReaderSize(r, 256<<10)
	for {
		line, err := br.ReadBytes('\n')
		if len(bytes.TrimSpace(line)) > 0 {
			if ierr := imp.line(line); ierr != nil {
				return nil, ierr
			}
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
	}
	return imp.finish()
}

type importer struct {
	t   *Tx
	ctx context.Context
	got Counts
	end Counts

	table  *moveTable
	cols   []string
	pos    []int // argument position of each column, -1 for a column that is not inserted
	nargs  int
	query  string
	stmt   *sql.Stmt
	remap  int // argument position of the renumbered column, -1 if none
	state  int // positions of runs.state and runs.started_at, -1 for other tables
	start  int
	groups map[int64]int64
	bucket string
	// bucketPos is the argument position of the current table's bucket column, -1 if it
	// has none; uploads are the ids of the uploads the stream brought (parts name
	// theirs).
	bucketPos int
	uploads   map[string]struct{}

	placed  bool  // ImportOptions.Placed
	upd     bool  // the current table is blobs, whose rows are updated, not inserted
	updArgs []int // for an update: the argument positions of the SET values, then of blob_id and size
}

func (m *importer) closeStmt() {
	if m.stmt != nil {
		m.stmt.Close()
		m.stmt = nil
	}
}

func (m *importer) line(line []byte) error {
	switch line[0] {
	case '{':
		var head struct {
			T   string           `json:"t"`
			C   []string         `json:"c"`
			End map[string]int64 `json:"end"`
		}
		if err := json.Unmarshal(line, &head); err != nil {
			return fmt.Errorf("%w: %v", ErrMoveData, err)
		}
		if head.End != nil {
			m.end = head.End
			return nil
		}
		return m.header(head.T, head.C)
	case '[':
		return m.row(line)
	}
	return fmt.Errorf("%w: unexpected line", ErrMoveData)
}

func (m *importer) header(name string, cols []string) error {
	m.closeStmt()
	tab, ok := moveTableByName(name)
	if !ok {
		return fmt.Errorf("%w: unknown table %q", ErrMoveData, name)
	}
	m.table, m.cols = &tab, cols
	m.pos, m.nargs, m.remap, m.state, m.start, m.bucketPos = make([]int, len(cols)), 0, -1, -1, -1, -1
	var names []string
	for i, c := range cols {
		if slices.Contains(tab.skip, c) {
			m.pos[i] = -1
			continue
		}
		m.pos[i] = m.nargs
		switch {
		case c == "bucket" && tab.name != "buckets":
			m.bucketPos = m.nargs
		case c == tab.remap:
			m.remap = m.nargs
		case tab.name == "runs" && c == "state":
			m.state = m.nargs
		case tab.name == "runs" && c == "started_at":
			m.start = m.nargs
		}
		names = append(names, c)
		m.nargs++
	}
	m.query = "INSERT INTO " + tab.name + " (" + strings.Join(names, ",") + ") VALUES (" + placeholders(m.nargs) + ")"
	m.upd, m.updArgs = false, nil
	if m.placed && tab.name == "blobs" {
		// the rows exist (the target received the files): take them over
		var set []string
		idPos, sizePos, bucketPos := -1, -1, -1
		for i, c := range names {
			switch c {
			case "blob_id":
				idPos = i
				continue
			case "size":
				sizePos = i
			case "bucket":
				bucketPos = i
			}
			set = append(set, c+"=?")
			m.updArgs = append(m.updArgs, i)
		}
		if idPos < 0 || sizePos < 0 || bucketPos < 0 {
			return fmt.Errorf("%w: the blobs table lacks blob_id, size or bucket", ErrMoveData)
		}
		// only a row that was placed for this bucket is taken over: never another bucket's blob
		m.updArgs = append(m.updArgs, idPos, sizePos, bucketPos)
		m.query = "UPDATE blobs SET " + strings.Join(set, ",") + " WHERE blob_id=? AND size=? AND bucket=?"
		m.upd = true
	}
	if nc, ok := m.t.q.(noCancel); ok {
		stmt, err := nc.tx.PrepareContext(m.ctx, m.query)
		if err != nil {
			return err
		}
		m.stmt = stmt
	}
	if _, seen := m.got[tab.name]; !seen {
		m.got[tab.name] = 0
	}
	return nil
}

func (m *importer) row(line []byte) error {
	if m.table == nil {
		return fmt.Errorf("%w: a row before its table", ErrMoveData)
	}
	args, err := decodeRow(line, m.pos, m.nargs, len(m.cols))
	if err != nil {
		return fmt.Errorf("%w: %s: %v", ErrMoveData, m.table.name, err)
	}
	if m.remap >= 0 {
		old, _ := args[m.remap].(int64)
		n, ok := m.groups[old]
		if !ok {
			if n, err = m.t.NextGroupSeq(m.ctx); err != nil {
				return err
			}
			m.groups[old] = n
		}
		args[m.remap] = n
	}
	if m.state >= 0 && args[m.state] == "running" {
		args[m.state] = RunQueued
		if m.start >= 0 {
			args[m.start] = nil
		}
	}
	if err := m.belongs(args); err != nil {
		return err
	}
	if m.upd {
		upd := make([]any, len(m.updArgs))
		for i, p := range m.updArgs {
			upd[i] = args[p]
		}
		args = upd
	}
	var res sql.Result
	if m.stmt != nil {
		res, err = m.stmt.ExecContext(m.ctx, args...)
	} else {
		res, err = m.t.q.ExecContext(m.ctx, m.query, args...)
	}
	if err == nil && m.upd {
		if n, _ := res.RowsAffected(); n != 1 {
			return fmt.Errorf("%w: blob %v was not received for this bucket (or its size differs)", ErrMoveData, args[len(args)-3])
		}
	}
	if err != nil {
		if m.table.name == "buckets" && strings.Contains(err.Error(), "UNIQUE") {
			return ErrExists
		}
		return fmt.Errorf("meta: importing %s: %w", m.table.name, err)
	}
	m.got[m.table.name]++
	return nil
}

// belongs checks that a row is of the bucket the stream is for: the stream starts with
// the bucket's own row, and every other row names that bucket (a bucket's rows are
// all that a move imports; a stream that carries a row of another bucket — a version
// that hides an object of a neighbour, a token, a run — is refused as a whole).
func (m *importer) belongs(args []any) error {
	switch m.table.name {
	case "buckets":
		if m.bucket != "" {
			return fmt.Errorf("%w: the stream holds more than one bucket", ErrMoveData)
		}
		m.bucket, _ = args[0].(string)
		return nil
	}
	if m.bucket == "" {
		return fmt.Errorf("%w: a row of %s before the bucket's own row", ErrMoveData, m.table.name)
	}
	if m.bucketPos >= 0 {
		if got, _ := args[m.bucketPos].(string); got != m.bucket {
			return fmt.Errorf("%w: a row of %s belongs to bucket %q, the stream is of %q", ErrMoveData, m.table.name, got, m.bucket)
		}
	}
	switch m.table.name {
	case "uploads":
		if m.uploads == nil {
			m.uploads = map[string]struct{}{}
		}
		for i, c := range m.cols {
			if c == "upload_id" && m.pos[i] >= 0 {
				id, _ := args[m.pos[i]].(string)
				m.uploads[id] = struct{}{}
			}
		}
	case "parts":
		for i, c := range m.cols {
			if c == "upload_id" && m.pos[i] >= 0 {
				if id, _ := args[m.pos[i]].(string); id != "" {
					if _, ok := m.uploads[id]; !ok {
						return fmt.Errorf("%w: a part of upload %q, which is not one of the bucket's", ErrMoveData, id)
					}
				}
			}
		}
	}
	return nil
}

func (m *importer) finish() (Counts, error) {
	if m.end == nil {
		return nil, fmt.Errorf("%w: the stream ends without its row counts", ErrMoveData)
	}
	for _, tab := range moveTables {
		if m.got[tab.name] != m.end[tab.name] {
			return nil, fmt.Errorf("%w: %s has %d rows, the sender wrote %d", ErrMoveData, tab.name, m.got[tab.name], m.end[tab.name])
		}
	}
	if m.bucket == "" {
		return nil, fmt.Errorf("%w: no bucket row", ErrMoveData)
	}
	t, ctx := m.t, m.ctx
	// the references of the new home are counted from the version rows it holds
	// (a blob nobody references — one the sender sent and a purge then released —
	// is left for the collector, like any other)
	if _, err := t.q.ExecContext(ctx, `UPDATE blobs SET refs=(SELECT COUNT(*) FROM objects o WHERE o.blob_id=blobs.blob_id),
zero_since=CASE WHEN EXISTS (SELECT 1 FROM objects o WHERE o.blob_id=blobs.blob_id) THEN NULL ELSE COALESCE(zero_since, ?) END
WHERE bucket=?`, ms(t.now), m.bucket); err != nil {
		return nil, err
	}
	var dangling int64
	if err := t.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM objects o WHERE o.bucket=? AND o.blob_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM blobs b WHERE b.blob_id=o.blob_id)`, m.bucket).Scan(&dangling); err != nil {
		return nil, err
	}
	if dangling > 0 {
		return nil, fmt.Errorf("%w: %d version rows reference a blob that was not sent", ErrMoveData, dangling)
	}
	return m.got, nil
}

// decodeRow turns a line [v1,v2,...] into the arguments of the insert: the
// values of the columns that are inserted, in order.
func decodeRow(line []byte, pos []int, nargs, ncols int) ([]any, error) {
	dec := json.NewDecoder(bytes.NewReader(line))
	dec.UseNumber()
	var vals []any
	if err := dec.Decode(&vals); err != nil {
		return nil, err
	}
	if len(vals) != ncols {
		return nil, fmt.Errorf("a row of %d values for %d columns", len(vals), ncols)
	}
	args := make([]any, nargs)
	for i, v := range vals {
		if pos[i] < 0 {
			continue
		}
		switch x := v.(type) {
		case nil, string:
			args[pos[i]] = x
		case json.Number:
			n, err := x.Int64()
			if err != nil {
				return nil, err
			}
			args[pos[i]] = n
		case map[string]any:
			if raw, ok := x["s"].(string); ok { // a text value of bytes that are not UTF-8
				b, err := base64.StdEncoding.DecodeString(raw)
				if err != nil {
					return nil, err
				}
				args[pos[i]] = string(b)
				break
			}
			raw, ok := x["b"].(string)
			if !ok {
				return nil, fmt.Errorf("a malformed blob value")
			}
			b, err := base64.StdEncoding.DecodeString(raw)
			if err != nil {
				return nil, err
			}
			args[pos[i]] = b
		default:
			return nil, fmt.Errorf("unsupported value %v", v)
		}
	}
	return args, nil
}

// MoveBlob is a blob that the bucket's version rows reference.
type MoveBlob struct {
	BlobID    string
	Size      int64 // stored size
	PlainSize int64
	SSE       bool
	Seq       int64 // the highest seq among the version rows that reference it
}

// BucketBlobsAfter lists the blobs that version rows of the bucket with a seq
// greater than after reference, oldest first (a blob shared by several versions
// is listed once, with the newest seq). limit <= 0 lists them all.
func (q Q) BucketBlobsAfter(ctx context.Context, bucket string, after int64, limit int) ([]MoveBlob, error) {
	if limit <= 0 {
		limit = -1
	}
	rows, err := q.q.QueryContext(ctx, `SELECT o.blob_id, b.size, b.plain_size, b.sse, MAX(o.seq) AS s
FROM objects o JOIN blobs b ON b.blob_id=o.blob_id
WHERE o.bucket=? AND o.seq>? AND o.blob_id IS NOT NULL GROUP BY o.blob_id ORDER BY s LIMIT ?`, bucket, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MoveBlob
	for rows.Next() {
		var b MoveBlob
		var sse int
		if err := rows.Scan(&b.BlobID, &b.Size, &b.PlainSize, &sse, &b.Seq); err != nil {
			return nil, err
		}
		b.SSE = sse == 1
		out = append(out, b)
	}
	return out, rows.Err()
}

// BucketBlobRowsAfter lists the blob references of the version rows of the bucket with
// a seq greater than `after`, in seq order, one entry per row: a blob that several
// versions share is listed for each of them (the sender skips what it sent). It is
// what the passes of a move page through — O(limit) per page with the
// objects_bucket_seq index, where BucketBlobsAfter regroups everything after the
// cursor. MoveBlob.Seq is the row's seq. limit <= 0 lists them all.
func (q Q) BucketBlobRowsAfter(ctx context.Context, bucket string, after int64, limit int) ([]MoveBlob, error) {
	if limit <= 0 {
		limit = -1
	}
	rows, err := q.q.QueryContext(ctx, `SELECT o.seq, o.blob_id, b.size, b.plain_size, b.sse
FROM objects o JOIN blobs b ON b.blob_id=o.blob_id
WHERE o.bucket=? AND o.seq>? AND o.blob_id IS NOT NULL ORDER BY o.seq LIMIT ?`, bucket, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MoveBlob
	for rows.Next() {
		var b MoveBlob
		var sse int
		if err := rows.Scan(&b.Seq, &b.BlobID, &b.Size, &b.PlainSize, &sse); err != nil {
			return nil, err
		}
		b.SSE = sse == 1
		out = append(out, b)
	}
	return out, rows.Err()
}

// BucketMaxSeq is the highest seq among the bucket's version rows (0 if none).
func (q Q) BucketMaxSeq(ctx context.Context, bucket string) (int64, error) {
	var n sql.NullInt64
	err := q.q.QueryRowContext(ctx, `SELECT MAX(seq) FROM objects WHERE bucket=?`, bucket).Scan(&n)
	return n.Int64, err
}

// MovePart is the part file of an upload that is still open.
type MovePart struct {
	UploadID   string
	PartID     string
	StoredSize int64
}

// BucketParts lists the part files of the bucket's uploads.
func (q Q) BucketParts(ctx context.Context, bucket string) ([]MovePart, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT p.upload_id, p.part_id, p.stored_size FROM parts p
JOIN uploads u ON u.upload_id=p.upload_id WHERE u.bucket=? ORDER BY p.upload_id, p.number`, bucket)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MovePart
	for rows.Next() {
		var p MovePart
		if err := rows.Scan(&p.UploadID, &p.PartID, &p.StoredSize); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// BucketStoredBytes is what the bucket takes on the disk of the node that holds
// it, and so of the node that is to receive it: the stored size (ciphertext when
// encrypted) of the blobs its version rows reference — each blob once, however many
// versions share it — and of the part files of its open uploads. The bucket's own
// byte counters are logical (every version row counts its size, plaintext).
func (q Q) BucketStoredBytes(ctx context.Context, bucket string) (int64, error) {
	var blobs, parts int64
	if err := q.q.QueryRowContext(ctx, `SELECT COALESCE(SUM(size), 0) FROM blobs WHERE bucket=? AND refs>0`, bucket).Scan(&blobs); err != nil {
		return 0, err
	}
	if err := q.q.QueryRowContext(ctx, `SELECT COALESCE(SUM(p.stored_size), 0) FROM parts p
JOIN uploads u ON u.upload_id=p.upload_id WHERE u.bucket=?`, bucket).Scan(&parts); err != nil {
		return 0, err
	}
	return blobs + parts, nil
}

// DiscardBucketChunk is DiscardBucket in pieces: it removes at most limit rows of
// the bucket — runs and backfills, version rows, part rows, then the release of its
// blobs, in that order — and reports done when nothing but the small tables was
// left and the bucket row has been removed too. The old home of a moved bucket cleans
// up with it, one short transaction per call, so that the rows of a bucket with
// millions of versions do not hold the node's writer for all the seconds they take;
// whoever stops half way (a restart) calls it again for the same bucket and goes on.
// With the bucket row it returns the ids of the uploads that went with it, whose
// part files the caller removes once the transaction has committed. It fails with
// ErrNotFound if the bucket has no row left when it comes to remove it.
func (t *Tx) DiscardBucketChunk(ctx context.Context, bucket string, limit int) (done bool, uploads []string, err error) {
	if limit < 1 {
		limit = 1
	}
	budget := int64(limit)
	// each statement takes the bucket and the budget
	for _, query := range []string{
		`DELETE FROM runs WHERE id IN (SELECT id FROM runs WHERE bucket=? LIMIT ?)`,
		`DELETE FROM backfills WHERE id IN (SELECT id FROM backfills WHERE bucket=? LIMIT ?)`,
		`DELETE FROM objects WHERE seq IN (SELECT seq FROM objects WHERE bucket=? ORDER BY seq LIMIT ?)`,
		`DELETE FROM parts WHERE rowid IN (SELECT p.rowid FROM parts p JOIN uploads u ON u.upload_id=p.upload_id WHERE u.bucket=? LIMIT ?)`,
	} {
		res, err := t.q.ExecContext(ctx, query, bucket, budget)
		if err != nil {
			return false, nil, err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return false, nil, err
		}
		if budget -= n; budget <= 0 {
			return false, nil, nil
		}
	}
	// the blobs become unreferenced and follow the normal grace (ReleaseBucketBlobs, a piece at a time)
	res, err := t.q.ExecContext(ctx, `UPDATE blobs SET refs=0, zero_since=COALESCE(zero_since, ?) WHERE blob_id IN
(SELECT blob_id FROM blobs WHERE bucket=? AND (refs<>0 OR zero_since IS NULL) LIMIT ?)`, ms(t.now), bucket, budget)
	if err != nil {
		return false, nil, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, nil, err
	}
	if n >= budget {
		return false, nil, nil
	}
	// what is left — tokens, uploads, attachments — is small, and goes with the bucket row
	rows, err := t.q.QueryContext(ctx, `SELECT upload_id FROM uploads WHERE bucket=?`, bucket)
	if err != nil {
		return false, nil, err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return false, nil, err
		}
		uploads = append(uploads, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return false, nil, err
	}
	rows.Close()
	return true, uploads, t.DeleteBucket(ctx, bucket)
}

// DiscardBucket removes every row of the bucket, queued runs and backfills
// included, and releases its blobs for collection once the grace has passed. It
// writes nothing to the catalog and raises no event: the old home of a moved
// bucket cleans up with it (spec §8.8 step 6), and the new home with it when a
// move is abandoned. It fails with ErrNotFound if the bucket has no row.
func (t *Tx) DiscardBucket(ctx context.Context, bucket string) error {
	if err := t.ReleaseBucketBlobs(ctx, bucket); err != nil {
		return err
	}
	for _, table := range []string{"runs", "backfills"} {
		if _, err := t.q.ExecContext(ctx, `DELETE FROM `+table+` WHERE bucket=?`, bucket); err != nil {
			return err
		}
	}
	return t.DeleteBucket(ctx, bucket)
}
