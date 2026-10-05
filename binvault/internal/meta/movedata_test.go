package meta

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

// moveFixture fills a bucket "photos" with every kind of row that moves, next to a
// neighbour "other" that must stay out of the stream.
func moveFixture(t *testing.T, d *DB) {
	t.Helper()
	ctx := context.Background()
	now := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
	exp := now.Add(time.Hour)
	mustUpdate(t, d, func(tx *Tx) error {
		for _, name := range []string{"photos", "other"} {
			if err := tx.CreateBucket(ctx, &Bucket{Name: name, Generation: "g-" + name, Versioning: VersioningEnabled,
				DataKey: []byte{0, 1, 2, 0, 255}, Lifecycle: []LifecycleRule{{ID: "r1", ExpireDays: 3}}}); err != nil {
				return err
			}
		}
		// blobs: b1 once, b2 shared by two versions, b3 garbage (no reference left)
		for _, b := range []Blob{{BlobID: "b1", Bucket: "photos", Size: 10, PlainSize: 10, Refs: 1},
			{BlobID: "b2", Bucket: "photos", Size: 20, PlainSize: 20, SSE: true, Refs: 2},
			{BlobID: "b3", Bucket: "photos", Size: 30, PlainSize: 30, Refs: 0},
			{BlobID: "o1", Bucket: "other", Size: 5, PlainSize: 5, Refs: 1}} {
			b := b
			if err := tx.InsertBlob(ctx, &b); err != nil {
				return err
			}
		}
		objs := []Object{
			{Bucket: "photos", Key: "a", Version: "v1", Size: 10, BlobID: "b1", ETag: "e1", CreatedAt: now, Tags: map[string]string{"k": "v"}},
			{Bucket: "photos", Key: "a", Version: "v2", IsLatest: true, Size: 20, BlobID: "b2", ETag: "e2", CreatedAt: now, SSE: true, Metadata: map[string]string{"m": "ü"}},
			{Bucket: "photos", Key: "b", Version: "v3", Size: 20, BlobID: "b2", ETag: "e2", CreatedAt: now, SSE: true},
			{Bucket: "photos", Key: "b", Version: "v4", IsLatest: true, DeleteMarker: true, CreatedAt: now},
			{Bucket: "other", Key: "x", Version: "w1", IsLatest: true, Size: 5, BlobID: "o1", ETag: "e", CreatedAt: now},
		}
		for i := range objs {
			if err := tx.InsertObject(ctx, &objs[i]); err != nil {
				return err
			}
		}
		if err := tx.AddCounters(ctx, "photos", Counters{Objects: 1, Versions: 4, DeleteMarkers: 1, Bytes: 50}); err != nil {
			return err
		}
		// uploads: one open with two parts, one completed
		for _, u := range []Upload{{UploadID: "u1", Bucket: "photos", Key: "big", InitiatedAt: now, UpdatedAt: now, Headers: map[string]string{"Content-Type": "x/y"}},
			{UploadID: "u2", Bucket: "photos", Key: "done", InitiatedAt: now, UpdatedAt: now}} {
			u := u
			if err := tx.CreateUpload(ctx, &u); err != nil {
				return err
			}
		}
		if err := tx.CompleteUpload(ctx, "u2", "h", []byte(`{"etag":"z"}`)); err != nil {
			return err
		}
		for n, id := range []string{"pa", "pb"} {
			if _, err := tx.PutPart(ctx, &Part{UploadID: "u1", Number: n + 1, PartID: id, Size: 7, StoredSize: 7, ETag: "pe", CreatedAt: now}); err != nil {
				return err
			}
		}
		if err := tx.CreateToken(ctx, &Token{AccessKeyID: "BVKAAAAAAAAAAAAAAAAA", Bucket: "photos", Name: "web", Secret: []byte{0, 9, 0, 200},
			Grants: []Grant{{Actions: []string{"read"}, Keys: []string{"a/*"}}}, ExpiresAt: &exp, CreatedAt: now}); err != nil {
			return err
		}
		if err := tx.CreateToken(ctx, &Token{AccessKeyID: "BVKBBBBBBBBBBBBBBBBB", Bucket: "other", Name: "o", Secret: []byte{1}, CreatedAt: now,
			Grants: []Grant{{Actions: []string{"read"}}}}); err != nil {
			return err
		}
		if _, err := tx.ReplaceAttachments(ctx, "photos", []Attachment{{Bucket: "photos", Pipeline: "p1", Generation: "pg", Enabled: true, Match: `{}`},
			{Bucket: "photos", Pipeline: "p2", Generation: "pg2", Enabled: false, Match: `{"keys":["a/**"]}`}}, 0); err != nil {
			return err
		}
		// runs: two share a group, one is running, one belongs to the neighbour
		g1, _ := tx.NextGroupSeq(ctx)
		g2, _ := tx.NextGroupSeq(ctx)
		g3, _ := tx.NextGroupSeq(ctx)
		started := now
		mk := func(id string, group int64, bucket, state string, step int) *Run {
			r := &Run{ID: id, GroupSeq: group, EventID: "evt-" + id[:2], Pipeline: "p1", Stage: "after", Bucket: bucket, Key: "a",
				Event: "object.created", Operation: "put", State: state, Step: step, Steps: 2, MaxAttempts: 3, QueuedAt: now, Payload: `{"x":1}`}
			if state == RunRunning {
				r.StartedAt = &started
				r.Attempt = 1
			}
			return r
		}
		if err := tx.InsertRuns(ctx, mk("r1-a", g1, "photos", RunQueued, 1), mk("r1-b", g1, "photos", RunQueued, 2),
			mk("r2-a", g2, "photos", RunRunning, 1), mk("r3-a", g3, "other", RunQueued, 1)); err != nil {
			return err
		}
		return tx.CreateBackfill(ctx, &Backfill{ID: "bf1", Bucket: "photos", Pipeline: "p1", Prefix: "a/", State: BackfillRunning, Cursor: "a/5", Scanned: 5, CreatedAt: now})
	})
}

func TestBucketExportImportRoundTrip(t *testing.T) {
	ctx := context.Background()
	src, dst := openTest(t), openTest(t)
	moveFixture(t, src)

	// the new home already has traffic of its own: its numbering is ahead
	mustUpdate(t, dst, func(tx *Tx) error {
		if err := tx.CreateBucket(ctx, &Bucket{Name: "mine", Generation: "gm"}); err != nil {
			return err
		}
		for i, v := range []string{"m1", "m2", "m3"} {
			if err := tx.InsertObject(ctx, &Object{Bucket: "mine", Key: "k", Version: v, IsLatest: i == 2, CreatedAt: time.Now()}); err != nil {
				return err
			}
		}
		for i := 0; i < 5; i++ {
			if _, err := tx.NextGroupSeq(ctx); err != nil {
				return err
			}
		}
		return nil
	})

	var stream bytes.Buffer
	counts, err := src.ExportBucket(ctx, "photos", &stream)
	if err != nil {
		t.Fatal(err)
	}
	want := Counts{"buckets": 1, "blobs": 2, "objects": 4, "uploads": 2, "parts": 2, "tokens": 1, "attachments": 2, "runs": 3, "backfills": 1}
	for table, n := range want {
		if counts[table] != n {
			t.Fatalf("exported %s: %d, want %d (%v)", table, counts[table], n, counts)
		}
	}
	if strings.Contains(stream.String(), "o1") || strings.Contains(stream.String(), "BVKBBBB") || strings.Contains(stream.String(), `"b3"`) {
		t.Fatal("the stream holds rows of another bucket or a blob nobody references")
	}

	var got Counts
	mustUpdate(t, dst, func(tx *Tx) (err error) {
		got, err = tx.ImportBucket(ctx, bytes.NewReader(stream.Bytes()))
		return err
	})
	for table, n := range want {
		if got[table] != n {
			t.Fatalf("imported %s: %d, want %d", table, got[table], n)
		}
	}

	q := dst.Read()
	b, err := q.GetBucket(ctx, "photos")
	if err != nil || b.Generation != "g-photos" || !bytes.Equal(b.DataKey, []byte{0, 1, 2, 0, 255}) || b.Versioning != VersioningEnabled ||
		b.Versions != 4 || b.Objects != 1 || b.DeleteMarkers != 1 || b.Bytes != 50 || len(b.Lifecycle) != 1 || b.AttachmentsRevision != 1 {
		t.Fatalf("bucket %+v err %v", b, err)
	}
	// version rows keep their order and ids and get seq values past the new home's own
	res, err := q.ListVersions(ctx, "photos", ListOptions{MaxKeys: 100})
	if err != nil {
		t.Fatal(err)
	}
	var seqs []int64
	var versions []string
	for _, e := range res.Entries {
		if e.Obj != nil {
			seqs = append(seqs, e.Obj.Seq)
			versions = append(versions, e.Obj.Key+"/"+e.Obj.Version)
		}
	}
	if len(versions) != 4 {
		t.Fatalf("versions %v", versions)
	}
	max := int64(0)
	for _, id := range []string{"v1", "v2", "v3", "v4"} {
		o, err := q.GetVersion(ctx, "photos", map[string]string{"v1": "a", "v2": "a", "v3": "b", "v4": "b"}[id], id)
		if err != nil {
			t.Fatal(err)
		}
		if o.Seq <= 3 || o.Seq <= max {
			t.Fatalf("version %s has seq %d: the order of the source is lost (own rows end at 3, previous %d)", id, o.Seq, max)
		}
		max = o.Seq
	}
	o2, _ := q.GetVersion(ctx, "photos", "a", "v2")
	if !o2.IsLatest || !o2.SSE || o2.Metadata["m"] != "ü" || o2.BlobID != "b2" {
		t.Fatalf("version v2: %+v", o2)
	}
	if o1, _ := q.GetVersion(ctx, "photos", "a", "v1"); o1.Tags["k"] != "v" || o1.IsLatest {
		t.Fatalf("version v1: %+v", o1)
	}
	// reference counts are those of the version rows; the garbage blob did not travel
	for id, refs := range map[string]int64{"b1": 1, "b2": 2} {
		bl, err := q.GetBlob(ctx, id)
		if err != nil || bl.Refs != refs || bl.ZeroSince != nil {
			t.Fatalf("blob %s: %+v %v", id, bl, err)
		}
	}
	if _, err := q.GetBlob(ctx, "b3"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("garbage blob: %v", err)
	}
	if _, err := q.GetBlob(ctx, "o1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a neighbour's blob: %v", err)
	}
	// uploads, parts, tokens, attachments
	u1, err := q.GetUpload(ctx, "u1")
	if err != nil || u1.State != "open" || u1.Headers["Content-Type"] != "x/y" {
		t.Fatalf("upload u1 %+v %v", u1, err)
	}
	if u2, err := q.GetUpload(ctx, "u2"); err != nil || u2.State != "completed" || u2.CompleteHash != "h" || string(u2.CompleteResult) != `{"etag":"z"}` {
		t.Fatalf("upload u2 %+v %v", u2, err)
	}
	parts, err := q.BucketParts(ctx, "photos")
	if err != nil || len(parts) != 2 || parts[0].PartID != "pa" || parts[1].PartID != "pb" {
		t.Fatalf("parts %+v %v", parts, err)
	}
	tok, err := q.GetToken(ctx, "BVKAAAAAAAAAAAAAAAAA")
	if err != nil || !bytes.Equal(tok.Secret, []byte{0, 9, 0, 200}) || tok.Grants[0].Keys[0] != "a/*" || tok.ExpiresAt == nil {
		t.Fatalf("token %+v %v", tok, err)
	}
	if _, err := q.GetToken(ctx, "BVKBBBBBBBBBBBBBBBBB"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a neighbour's token: %v", err)
	}
	atts, err := q.ListAttachments(ctx, "photos")
	if err != nil || len(atts) != 2 || atts[0].Pipeline != "p1" || !atts[0].Enabled || atts[1].Pipeline != "p2" || atts[1].Enabled || atts[1].Match != `{"keys":["a/**"]}` {
		t.Fatalf("attachments %+v %v", atts, err)
	}
	// runs: the groups are renumbered consistently, the running one is queued again
	byID := map[string]*Run{}
	for _, id := range []string{"r1-a", "r1-b", "r2-a"} {
		r, err := q.GetRun(ctx, id)
		if err != nil {
			t.Fatalf("run %s: %v", id, err)
		}
		byID[id] = r
	}
	if byID["r1-a"].GroupSeq != byID["r1-b"].GroupSeq || byID["r1-a"].GroupSeq <= 5 || byID["r2-a"].GroupSeq <= byID["r1-a"].GroupSeq {
		t.Fatalf("group numbers %d %d %d", byID["r1-a"].GroupSeq, byID["r1-b"].GroupSeq, byID["r2-a"].GroupSeq)
	}
	if r := byID["r2-a"]; r.State != RunQueued || r.StartedAt != nil || r.Attempt != 1 {
		t.Fatalf("the run that was running: %+v", r)
	}
	if _, err := q.GetRun(ctx, "r3-a"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a neighbour's run: %v", err)
	}
	if bf, err := q.GetBackfill(ctx, "bf1"); err != nil || bf.State != BackfillRunning || bf.Cursor != "a/5" || bf.Scanned != 5 {
		t.Fatalf("backfill %+v %v", bf, err)
	}
	// the next group number of the new home continues after the imported ones
	var next int64
	mustUpdate(t, dst, func(tx *Tx) (err error) { next, err = tx.NextGroupSeq(ctx); return })
	if next <= byID["r2-a"].GroupSeq {
		t.Fatalf("next group %d <= %d", next, byID["r2-a"].GroupSeq)
	}

	// the same bucket cannot be imported twice
	err = dst.Update(ctx, func(tx *Tx) error { _, err := tx.ImportBucket(ctx, bytes.NewReader(stream.Bytes())); return err })
	if !errors.Is(err, ErrExists) {
		t.Fatalf("a second import: %v", err)
	}
}

// A key or a content header is whatever bytes the client sent, valid UTF-8 or not: the stream
// carries such a text value as {"s":"base64"} (a JSON string would turn the bytes into U+FFFD),
// and a bucket that holds one can be moved all the same.
func TestBucketExportImportCarriesTextThatIsNotUTF8(t *testing.T) {
	ctx := context.Background()
	src, dst := openTest(t), openTest(t)
	now := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
	odd := Object{Bucket: "raw", Key: "caf\xe9/\xff\xfe.png", Version: "v1", IsLatest: true, CreatedAt: now, DeleteMarker: true,
		ContentDisposition: "attachment; filename=\"caf\xe9.png\"", ContentType: "text/\xc3\x28", CacheControl: "\x80"}
	// text that looks like the escape is still only text
	lookalike := Object{Bucket: "raw", Key: `{"s":"AAAA"}`, Version: "v2", IsLatest: true, CreatedAt: now, DeleteMarker: true,
		ContentDisposition: `{"b":"AAAA"}`}
	mustUpdate(t, src, func(tx *Tx) error {
		if err := tx.CreateBucket(ctx, &Bucket{Name: "raw", Generation: "g-raw", Versioning: VersioningEnabled}); err != nil {
			return err
		}
		for _, o := range []Object{odd, lookalike} {
			o := o
			if err := tx.InsertObject(ctx, &o); err != nil {
				return err
			}
		}
		return nil
	})
	var stream bytes.Buffer
	if _, err := src.ExportBucket(ctx, "raw", &stream); err != nil {
		t.Fatalf("the export of a bucket with text that is not UTF-8: %v", err)
	}
	if !utf8.Valid(stream.Bytes()) || !strings.Contains(stream.String(), `{"s":"`) {
		t.Fatalf("the stream is not valid UTF-8 text, or does not use the escape for the bytes that are not: %q", stream.String())
	}
	mustUpdate(t, dst, func(tx *Tx) error { _, err := tx.ImportBucket(ctx, bytes.NewReader(stream.Bytes())); return err })
	q := dst.Read()
	for _, want := range []Object{odd, lookalike} {
		got, err := q.GetVersion(ctx, "raw", want.Key, want.Version)
		if err != nil {
			t.Fatalf("version %s of %q: %v", want.Version, want.Key, err)
		}
		if got.Key != want.Key || got.ContentDisposition != want.ContentDisposition || got.ContentType != want.ContentType || got.CacheControl != want.CacheControl {
			t.Fatalf("version %s came out as %q %q %q %q, went in as %q %q %q %q", want.Version, got.Key, got.ContentDisposition, got.ContentType, got.CacheControl,
				want.Key, want.ContentDisposition, want.ContentType, want.CacheControl)
		}
	}
	// a damaged escape is a damaged stream
	bad := strings.Replace(stream.String(), `{"s":"`, `{"s":"!!`, 1)
	err := openTest(t).Update(ctx, func(tx *Tx) error { _, err := tx.ImportBucket(ctx, strings.NewReader(bad)); return err })
	if err == nil {
		t.Fatal("a stream with a damaged base64 escape was imported")
	}
}

func TestImportRejectsDamagedStreams(t *testing.T) {
	ctx := context.Background()
	src := openTest(t)
	moveFixture(t, src)
	var stream bytes.Buffer
	if _, err := src.ExportBucket(ctx, "photos", &stream); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimRight(stream.String(), "\n"), "\n")
	cases := map[string]string{
		"no end line":    strings.Join(lines[:len(lines)-1], "\n") + "\n",
		"a lost row":     strings.Join(append(append([]string{}, lines[:5]...), lines[6:]...), "\n") + "\n",
		"unknown table":  `{"t":"pipelines","c":["name"]}` + "\n" + strings.Join(lines, "\n") + "\n",
		"garbage":        "not json\n",
		"row first":      `["a"]` + "\n",
		"empty":          "",
		"truncated line": stream.String()[:stream.Len()/2],
	}
	for name, data := range cases {
		dst := openTest(t)
		err := dst.Update(ctx, func(tx *Tx) error { _, err := tx.ImportBucket(ctx, strings.NewReader(data)); return err })
		if err == nil {
			t.Fatalf("%s: the import succeeded", name)
		}
		if _, gerr := dst.Read().GetBucket(ctx, "photos"); !errors.Is(gerr, ErrNotFound) {
			t.Fatalf("%s: a failed import left the bucket behind: %v", name, gerr)
		}
	}
}

// The stream of a move holds one bucket: a row that names another one — a version that hides a
// neighbour's object, a token, a part of a neighbour's upload, a blob row taken over from another
// bucket — makes the whole import fail, and nothing of it stays.
func TestImportRefusesRowsOfAnotherBucket(t *testing.T) {
	ctx := context.Background()
	src := openTest(t)
	moveFixture(t, src)
	export := func(bucket string) []string {
		var b bytes.Buffer
		if _, err := src.ExportBucket(ctx, bucket, &b); err != nil {
			t.Fatal(err)
		}
		return strings.Split(strings.TrimRight(b.String(), "\n"), "\n")
	}
	photos, other := export("photos"), export("other")
	// the data lines of a table of a stream
	header := func(l, table string) (isHeader, ofTable bool) {
		if !strings.HasPrefix(l, `{"c":`) {
			return false, false
		}
		return true, strings.HasSuffix(l, `"t":"`+table+`"}`)
	}
	rowsOf := func(lines []string, table string) []string {
		var out []string
		in := false
		for _, l := range lines {
			if isHeader, ofTable := header(l, table); isHeader {
				in = ofTable
			} else if strings.HasPrefix(l, `[`) && in {
				out = append(out, l)
			}
		}
		return out
	}
	// the stream with a data line added to / taken from a table, and the row counts of its end line kept right
	edit := func(lines []string, table string, add, drop []string) string {
		var out []string
		in := false
		for _, l := range lines {
			isHeader, ofTable := header(l, table)
			switch {
			case isHeader:
				in = ofTable
				out = append(out, l)
				if in {
					out = append(out, add...)
				}
				continue
			case strings.HasPrefix(l, `{"end"`):
				var e struct {
					End map[string]int64 `json:"end"`
				}
				if err := json.Unmarshal([]byte(l), &e); err != nil {
					t.Fatal(err)
				}
				e.End[table] += int64(len(add) - len(drop))
				raw, _ := json.Marshal(e)
				l = string(raw)
			case in && slices.Contains(drop, l):
				continue
			}
			out = append(out, l)
		}
		return strings.Join(out, "\n") + "\n"
	}
	tryImport := func(t *testing.T, name, stream string, opt ImportOptions, dst *DB) {
		t.Helper()
		err := dst.Update(ctx, func(tx *Tx) error { _, err := tx.ImportBucketWith(ctx, strings.NewReader(stream), opt); return err })
		if !errors.Is(err, ErrMoveData) {
			t.Fatalf("%s: the import answered %v, want ErrMoveData", name, err)
		}
		if _, gerr := dst.Read().GetBucket(ctx, "photos"); !errors.Is(gerr, ErrNotFound) {
			t.Fatalf("%s: a refused import left the bucket behind: %v", name, gerr)
		}
	}

	t.Run("control", func(t *testing.T) { // the untouched stream imports
		dst := openTest(t)
		mustUpdate(t, dst, func(tx *Tx) error {
			_, err := tx.ImportBucket(ctx, strings.NewReader(strings.Join(photos, "\n")+"\n"))
			return err
		})
	})
	t.Run("a version of another bucket", func(t *testing.T) {
		tryImport(t, "objects", edit(photos, "objects", rowsOf(other, "objects"), nil), ImportOptions{}, openTest(t))
	})
	t.Run("a token of another bucket", func(t *testing.T) {
		tryImport(t, "tokens", edit(photos, "tokens", rowsOf(other, "tokens"), nil), ImportOptions{}, openTest(t))
	})
	t.Run("a second bucket", func(t *testing.T) {
		tryImport(t, "buckets", edit(photos, "buckets", rowsOf(other, "buckets"), nil), ImportOptions{}, openTest(t))
	})
	t.Run("rows before the bucket", func(t *testing.T) {
		n := len(photos)
		moved := append(append(append([]string{}, photos[2:n-1]...), photos[0], photos[1]), photos[n-1])
		tryImport(t, "reordered", strings.Join(moved, "\n")+"\n", ImportOptions{}, openTest(t))
	})
	t.Run("a part of an upload that is not the bucket's", func(t *testing.T) {
		tryImport(t, "parts", edit(photos, "uploads", nil, rowsOf(photos, "uploads")), ImportOptions{}, openTest(t))
	})
	t.Run("a placed blob of another bucket", func(t *testing.T) {
		dst := openTest(t)
		mustUpdate(t, dst, func(tx *Tx) error {
			if err := tx.CreateBucket(ctx, &Bucket{Name: "neighbour", Generation: "gn"}); err != nil {
				return err
			}
			if err := tx.InsertPlacedBlob(ctx, &Blob{BlobID: "b1", Bucket: "neighbour", Size: 10, PlainSize: 10}); err != nil {
				return err
			}
			return tx.InsertPlacedBlob(ctx, &Blob{BlobID: "b2", Bucket: "photos", Size: 20, PlainSize: 20, SSE: true})
		})
		tryImport(t, "placed", strings.Join(photos, "\n")+"\n", ImportOptions{Placed: true}, dst)
		if b, err := dst.Read().GetBlob(ctx, "b1"); err != nil || b.Bucket != "neighbour" {
			t.Fatalf("the neighbour's blob row: %+v %v", b, err)
		}
	})
}

// What a bucket takes on disk: each referenced blob once whatever the number of versions that
// share it, no garbage, plus the part files of its open uploads.
func TestBucketStoredBytes(t *testing.T) {
	ctx := context.Background()
	d := openTest(t)
	moveFixture(t, d)
	got, err := d.Read().BucketStoredBytes(ctx, "photos")
	// b1 (10) and b2 (20, shared by two versions) count once, b3 (30) is garbage, the two parts are 7 each
	if err != nil || got != 10+20+7+7 {
		t.Fatalf("stored bytes of photos: %d %v", got, err)
	}
	if got, err := d.Read().BucketStoredBytes(ctx, "other"); err != nil || got != 5 {
		t.Fatalf("stored bytes of the neighbour: %d %v", got, err)
	}
	if got, err := d.Read().BucketStoredBytes(ctx, "nothing"); err != nil || got != 0 {
		t.Fatalf("stored bytes of a bucket that is not there: %d %v", got, err)
	}
}

// DiscardBucketChunk takes the bucket apart in pieces — each call is one short transaction — and
// leaves the same state as DiscardBucket; a caller that stops half way goes on with the same calls.
func TestDiscardBucketChunkRemovesTheBucketInPieces(t *testing.T) {
	ctx := context.Background()
	d := openTest(t)
	moveFixture(t, d)
	calls := 0
	var uploads []string
	for {
		var done bool
		var gone []string
		mustUpdate(t, d, func(tx *Tx) (err error) {
			done, gone, err = tx.DiscardBucketChunk(ctx, "photos", 2)
			return err
		})
		calls++
		if done {
			uploads = gone
			break
		}
		if len(gone) != 0 {
			t.Fatalf("a piece that is not the last reported uploads: %v", gone)
		}
		// half way: the bucket is still there, and so is what has not been reached
		if _, err := d.Read().GetBucket(ctx, "photos"); err != nil {
			t.Fatalf("the bucket row went before the last piece: %v", err)
		}
		if calls > 50 {
			t.Fatal("the pieces do not end")
		}
	}
	// 3 runs, a backfill, 4 versions, 2 parts, 3 blobs: with two rows a piece that is several calls
	if calls < 5 {
		t.Fatalf("the bucket was removed in %d calls: not in pieces", calls)
	}
	slices.Sort(uploads)
	if !slices.Equal(uploads, []string{"u1", "u2"}) {
		t.Fatalf("the uploads that went with the bucket: %v", uploads)
	}
	q := d.Read()
	if _, err := q.GetBucket(ctx, "photos"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("the bucket: %v", err)
	}
	for _, table := range []string{"objects", "uploads", "parts", "tokens", "attachments", "runs", "backfills"} {
		var n int64
		query := `SELECT COUNT(*) FROM ` + table + ` WHERE bucket='photos'`
		if table == "parts" {
			query = `SELECT COUNT(*) FROM parts WHERE upload_id IN ('u1','u2')`
		}
		if err := d.w.QueryRowContext(ctx, query).Scan(&n); err != nil || n != 0 {
			t.Fatalf("%s rows left: %d %v", table, n, err)
		}
	}
	// the blobs are released for the collector, the neighbour is untouched
	for _, id := range []string{"b1", "b2", "b3"} {
		b, err := q.GetBlob(ctx, id)
		if err != nil || b.Refs != 0 || b.ZeroSince == nil {
			t.Fatalf("blob %s: %+v %v", id, b, err)
		}
	}
	if b, err := q.GetBlob(ctx, "o1"); err != nil || b.Refs != 1 {
		t.Fatalf("the neighbour's blob: %+v %v", b, err)
	}
	if n, err := q.CountRuns(ctx, RunFilter{Bucket: "other"}); err != nil || n != 1 {
		t.Fatalf("the neighbour's runs: %d %v", n, err)
	}
	if o, err := q.GetVersion(ctx, "other", "x", "w1"); err != nil || o.BlobID != "o1" {
		t.Fatalf("the neighbour's version: %+v %v", o, err)
	}
	// a bucket that is not there is not found, not done
	err := d.Update(ctx, func(tx *Tx) error { _, _, err := tx.DiscardBucketChunk(ctx, "photos", 100); return err })
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("a piece of a bucket that is gone: %v", err)
	}
}

func TestBucketBlobListsAndDiscard(t *testing.T) {
	ctx := context.Background()
	d := openTest(t)
	moveFixture(t, d)
	q := d.Read()
	all, err := q.BucketBlobsAfter(ctx, "photos", 0, 0)
	if err != nil || len(all) != 2 {
		t.Fatalf("blobs %+v %v", all, err)
	}
	if all[0].BlobID != "b1" || all[1].BlobID != "b2" || !all[1].SSE || all[1].Size != 20 || all[1].Seq <= all[0].Seq {
		t.Fatalf("blob order or fields: %+v", all)
	}
	// a pass after the first blob's seq lists what came since (b2 is newest, shared by two versions)
	later, err := q.BucketBlobsAfter(ctx, "photos", all[0].Seq, 0)
	if err != nil || len(later) != 1 || later[0].BlobID != "b2" {
		t.Fatalf("later blobs %+v %v", later, err)
	}
	if max, err := q.BucketMaxSeq(ctx, "photos"); err != nil || max < all[1].Seq {
		t.Fatalf("max seq %d %v", max, err)
	}
	if max, _ := q.BucketMaxSeq(ctx, "nothing"); max != 0 {
		t.Fatalf("max seq of nothing: %d", max)
	}

	mustUpdate(t, d, func(tx *Tx) error { return tx.DiscardBucket(ctx, "photos") })
	q = d.Read()
	if _, err := q.GetBucket(ctx, "photos"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("bucket after discard: %v", err)
	}
	for _, id := range []string{"r1-a", "r2-a"} {
		if _, err := q.GetRun(ctx, id); !errors.Is(err, ErrNotFound) {
			t.Fatalf("run %s after discard: %v", id, err)
		}
	}
	if _, err := q.GetBackfill(ctx, "bf1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("backfill after discard: %v", err)
	}
	for _, id := range []string{"b1", "b2"} {
		b, err := q.GetBlob(ctx, id)
		if err != nil || b.Refs != 0 || b.ZeroSince == nil {
			t.Fatalf("blob %s is left for collection: %+v %v", id, b, err)
		}
	}
	// the neighbour is untouched
	if _, err := q.GetBucket(ctx, "other"); err != nil {
		t.Fatal(err)
	}
	if _, err := q.GetRun(ctx, "r3-a"); err != nil {
		t.Fatalf("a neighbour's run: %v", err)
	}
	if b, err := q.GetBlob(ctx, "o1"); err != nil || b.Refs != 1 {
		t.Fatalf("a neighbour's blob: %+v %v", b, err)
	}
	if err := d.Update(ctx, func(tx *Tx) error { return tx.DiscardBucket(ctx, "photos") }); !errors.Is(err, ErrNotFound) {
		t.Fatalf("discarding twice: %v", err)
	}
}
