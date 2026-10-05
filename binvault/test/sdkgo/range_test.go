package sdkgo

import (
	"bytes"
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func TestRange(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "range", nil)
	c := e.newClient(t, b)
	const size = 200000
	data := pattern(size, 7)
	key := "range/obj.bin"
	_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data)})
	must(t, err, "PutObject")

	cases := []struct {
		name, rng string
		from, to  int // inclusive window of data expected
	}{
		{"first_ten", "bytes=0-9", 0, 9},
		{"middle", "bytes=1000-1999", 1000, 1999},
		{"open_ended", "bytes=199990-", 199990, size - 1},
		{"suffix", "bytes=-10", size - 10, size - 1},
		{"suffix_longer_than_object", fmt.Sprintf("bytes=-%d", size*3), 0, size - 1},
		{"end_past_object_is_clamped", fmt.Sprintf("bytes=199000-%d", size*2), 199000, size - 1},
		{"single_byte", "bytes=65535-65535", 65535, 65535},
		{"across_64k_boundary", "bytes=65530-65545", 65530, 65545},
		{"whole_object", fmt.Sprintf("bytes=0-%d", size-1), 0, size - 1},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			out, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, Range: aws.String(tc.rng)})
			must(t, err, "GetObject "+tc.rng)
			got := readAll(t, out.Body)
			sameBytes(t, tc.rng, got, data[tc.from:tc.to+1])
			if aws.ToInt64(out.ContentLength) != int64(tc.to-tc.from+1) {
				t.Errorf("ContentLength %d, want %d", aws.ToInt64(out.ContentLength), tc.to-tc.from+1)
			}
			wantCR := fmt.Sprintf("bytes %d-%d/%d", tc.from, tc.to, size)
			if aws.ToString(out.ContentRange) != wantCR {
				t.Errorf("Content-Range %q, want %q", aws.ToString(out.ContentRange), wantCR)
			}
			if aws.ToString(out.AcceptRanges) != "bytes" {
				t.Errorf("Accept-Ranges %q, want bytes", aws.ToString(out.AcceptRanges))
			}
		})
	}

	t.Run("start_past_end_is_invalidrange", func(t *testing.T) {
		_, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, Range: aws.String(fmt.Sprintf("bytes=%d-", size))})
		requireAPIError(t, err, "InvalidRange", 416)
	})

	t.Run("range_on_empty_object_is_invalidrange", func(t *testing.T) {
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("range/empty"), Body: bytes.NewReader(nil)})
		must(t, err, "PutObject empty")
		_, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("range/empty"), Range: aws.String("bytes=0-0")})
		requireAPIError(t, err, "InvalidRange", 416)
	})

	t.Run("head_with_range", func(t *testing.T) {
		out, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key, Range: aws.String("bytes=10-19")})
		must(t, err, "HeadObject with Range")
		if aws.ToInt64(out.ContentLength) != 10 {
			t.Errorf("HEAD with Range: ContentLength %d, want 10", aws.ToInt64(out.ContentLength))
		}
		if aws.ToString(out.ContentRange) != fmt.Sprintf("bytes 10-19/%d", size) {
			t.Errorf("HEAD with Range: Content-Range %q", aws.ToString(out.ContentRange))
		}
	})

	t.Run("multiple_ranges_return_the_whole_object", func(t *testing.T) {
		out, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, Range: aws.String("bytes=0-9,20-29")})
		must(t, err, "GetObject with two ranges")
		sameBytes(t, "body", readAll(t, out.Body), data)
	})
}

func TestConditional(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "cond", nil)
	c := e.newClient(t, b)
	key := "cond/obj"
	data := []byte("conditional requests")
	put, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data)})
	must(t, err, "PutObject")
	etag := aws.ToString(put.ETag)
	head, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key})
	must(t, err, "HeadObject")
	lm := aws.ToTime(head.LastModified)
	past, future := lm.Add(-time.Hour), lm.Add(time.Hour)

	get := func(mod func(*s3.GetObjectInput)) error {
		in := &s3.GetObjectInput{Bucket: &b.Name, Key: &key}
		mod(in)
		out, err := c.GetObject(ctx, in)
		if err == nil {
			_ = readAll(t, out.Body)
		}
		return err
	}
	t.Run("get_if_match_ok", func(t *testing.T) {
		must(t, get(func(in *s3.GetObjectInput) { in.IfMatch = &etag }), "If-Match with the current ETag")
	})
	t.Run("get_if_match_mismatch_is_412", func(t *testing.T) {
		requireAPIError(t, get(func(in *s3.GetObjectInput) { in.IfMatch = aws.String(`"deadbeef"`) }), "PreconditionFailed", 412)
	})
	t.Run("get_if_none_match_is_304", func(t *testing.T) {
		requireAPIError(t, get(func(in *s3.GetObjectInput) { in.IfNoneMatch = &etag }), "", 304)
	})
	t.Run("get_if_none_match_other_etag_ok", func(t *testing.T) {
		must(t, get(func(in *s3.GetObjectInput) { in.IfNoneMatch = aws.String(`"deadbeef"`) }), "If-None-Match with another ETag")
	})
	t.Run("get_if_modified_since_future_is_304", func(t *testing.T) {
		requireAPIError(t, get(func(in *s3.GetObjectInput) { in.IfModifiedSince = &future }), "", 304)
	})
	t.Run("get_if_modified_since_past_ok", func(t *testing.T) {
		must(t, get(func(in *s3.GetObjectInput) { in.IfModifiedSince = &past }), "If-Modified-Since in the past")
	})
	t.Run("get_if_unmodified_since_past_is_412", func(t *testing.T) {
		requireAPIError(t, get(func(in *s3.GetObjectInput) { in.IfUnmodifiedSince = &past }), "PreconditionFailed", 412)
	})
	t.Run("get_if_unmodified_since_future_ok", func(t *testing.T) {
		must(t, get(func(in *s3.GetObjectInput) { in.IfUnmodifiedSince = &future }), "If-Unmodified-Since in the future")
	})
	t.Run("head_if_match_mismatch_is_412", func(t *testing.T) {
		_, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key, IfMatch: aws.String(`"deadbeef"`)})
		requireAPIError(t, err, "", 412)
	})
	t.Run("head_if_none_match_is_304", func(t *testing.T) {
		_, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key, IfNoneMatch: &etag})
		requireAPIError(t, err, "", 304)
	})

	t.Run("put_if_none_match_star_creates_then_conflicts", func(t *testing.T) {
		k := "cond/create-only"
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &k, Body: bytes.NewReader([]byte("one")), IfNoneMatch: aws.String("*")})
		must(t, err, "first create-only PutObject")
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &k, Body: bytes.NewReader([]byte("two")), IfNoneMatch: aws.String("*")})
		requireAPIError(t, err, "PreconditionFailed", 412)
		out, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &k})
		must(t, err, "GetObject")
		sameBytes(t, "body", readAll(t, out.Body), []byte("one"))
	})
	t.Run("put_if_match_swaps_only_on_current_etag", func(t *testing.T) {
		k := "cond/cas"
		p1, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &k, Body: bytes.NewReader([]byte("v1"))})
		must(t, err, "PutObject v1")
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &k, Body: bytes.NewReader([]byte("v2")), IfMatch: aws.String(`"deadbeef"`)})
		requireAPIError(t, err, "PreconditionFailed", 412)
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &k, Body: bytes.NewReader([]byte("v2")), IfMatch: p1.ETag})
		must(t, err, "PutObject with the current ETag in If-Match")
		out, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &k})
		must(t, err, "GetObject")
		sameBytes(t, "body", readAll(t, out.Body), []byte("v2"))
	})
}
