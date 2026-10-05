package meta

import (
	"context"
	"strings"
	"testing"
	"time"
)

// Uploads are listed by key and, within a key, by initiation time (as S3 does),
// not by their random ids; the markers of a page follow the same order.
func TestListUploadsInInitiationOrder(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	base := time.Now().Add(-time.Hour).Truncate(time.Millisecond)
	// ids are the reverse of the initiation order for key "a"
	mustUpdate(t, d, func(tx *Tx) error {
		for i, u := range []Upload{
			{UploadID: "z1", Key: "a", InitiatedAt: base.Add(1 * time.Second)},
			{UploadID: "m1", Key: "a", InitiatedAt: base.Add(2 * time.Second)},
			{UploadID: "a1", Key: "a", InitiatedAt: base.Add(3 * time.Second)},
			{UploadID: "same2", Key: "a", InitiatedAt: base.Add(4 * time.Second)},
			{UploadID: "same1", Key: "a", InitiatedAt: base.Add(4 * time.Second)}, // same instant: the id breaks the tie
			{UploadID: "q", Key: "b", InitiatedAt: base},
		} {
			u := u
			u.Bucket, u.UpdatedAt = "b", u.InitiatedAt
			if err := tx.CreateUpload(ctx, &u); err != nil {
				t.Fatalf("%d: %v", i, err)
			}
		}
		return nil
	})
	ids := func(us []*Upload, err error) string {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		var out []string
		for _, u := range us {
			out = append(out, u.UploadID)
		}
		return strings.Join(out, ",")
	}
	q := d.Read()
	if got := ids(q.ListUploads(ctx, "b", "", "", "", 100)); got != "z1,m1,a1,same1,same2,q" {
		t.Fatalf("all: %s", got)
	}
	// paging by (key-marker, upload-id-marker) resumes after exactly that upload
	if got := ids(q.ListUploads(ctx, "b", "", "a", "m1", 100)); got != "a1,same1,same2,q" {
		t.Fatalf("after m1: %s", got)
	}
	if got := ids(q.ListUploads(ctx, "b", "", "a", "same1", 100)); got != "same2,q" {
		t.Fatalf("after same1: %s", got)
	}
	if got := ids(q.ListUploads(ctx, "b", "", "a", "same2", 100)); got != "q" {
		t.Fatalf("after the last upload of a: %s", got)
	}
	if got := ids(q.ListUploads(ctx, "b", "", "a", "", 100)); got != "q" {
		t.Fatalf("key marker alone skips the key: %s", got)
	}
	var walked []string
	km, um := "", ""
	for {
		page, err := q.ListUploads(ctx, "b", "", km, um, 2)
		if err != nil {
			t.Fatal(err)
		}
		for _, u := range page {
			walked = append(walked, u.UploadID)
		}
		if len(page) < 2 {
			break
		}
		last := page[len(page)-1]
		km, um = last.Key, last.UploadID
	}
	if got := strings.Join(walked, ","); got != "z1,m1,a1,same1,same2,q" {
		t.Fatalf("paged by two: %s", got)
	}

	// a clean-up loop aborts what it listed before asking for the next page: the marker
	// upload is gone, and the rest of its key must not be skipped
	mustUpdate(t, d, func(tx *Tx) error {
		for _, id := range []string{"z1", "m1"} {
			if err := tx.DeleteUpload(ctx, id); err != nil {
				return err
			}
		}
		return nil
	})
	if got := ids(q.ListUploads(ctx, "b", "", "a", "m1", 100)); got != "a1,same1,same2,q" {
		t.Fatalf("marker upload gone: %s", got)
	}
	// the marker must belong to the key: an id of another key does not shift the page
	if got := ids(q.ListUploads(ctx, "b", "", "a", "q", 100)); got != "a1,same1,same2,q" {
		t.Fatalf("foreign marker: %s", got)
	}
	// the resume-beyond-a-prefix variant is ordered the same way
	if got := ids(q.ListUploadsFrom(ctx, "b", "", "a", 100)); got != "a1,same1,same2,q" {
		t.Fatalf("from: %s", got)
	}
}
