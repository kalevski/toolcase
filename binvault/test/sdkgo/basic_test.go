package sdkgo

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var ctx = context.Background()

func TestBasic(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "basic", nil)
	rec := &recorder{}
	c := e.newClient(t, b, withRecorder(rec))

	for _, size := range []int{0, 1, 64*KiB - 1, 64 * KiB, 64*KiB + 1, 1 * MiB, 8 * MiB} {
		size := size
		t.Run(fmt.Sprintf("roundtrip_size_%d", size), func(t *testing.T) {
			key := fmt.Sprintf("rt/%d.bin", size)
			data := pattern(size, size)
			put, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data)})
			must(t, err, "PutObject")
			if aws.ToString(put.ETag) != etagOf(data) {
				t.Fatalf("PutObject ETag %q, want %q", aws.ToString(put.ETag), etagOf(data))
			}
			head, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key})
			must(t, err, "HeadObject")
			if aws.ToInt64(head.ContentLength) != int64(size) || aws.ToString(head.ETag) != etagOf(data) {
				t.Fatalf("HeadObject: length %d etag %q", aws.ToInt64(head.ContentLength), aws.ToString(head.ETag))
			}
			// The SDK sends Content-Type: application/octet-stream itself for blob bodies; the server must
			// return what was sent, and binary/octet-stream (spec 3.3) when the client sent none.
			wantCT := "binary/octet-stream"
			for _, w := range rec.matching("PUT", key) {
				if sent := w.hdr("Content-Type"); sent != "" {
					wantCT = sent
				}
			}
			if got := aws.ToString(head.ContentType); got != wantCT {
				t.Errorf("Content-Type %q, want %q", got, wantCT)
			}
			get, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
			must(t, err, "GetObject")
			sameBytes(t, "body", readAll(t, get.Body), data)
			_, err = c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: &key})
			must(t, err, "DeleteObject")
			_, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
			var nsk *types.NoSuchKey
			if !errors.As(err, &nsk) {
				t.Fatalf("GetObject after delete: want *types.NoSuchKey, got %T %v", err, err)
			}
		})
	}

	t.Run("metadata_and_content_headers", func(t *testing.T) {
		key := "meta/obj.txt"
		exp := time.Date(2031, 5, 6, 7, 8, 9, 0, time.UTC)
		data := []byte("headers and metadata")
		_, err := c.PutObject(ctx, &s3.PutObjectInput{
			Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data),
			ContentType: aws.String("text/x-test"), ContentDisposition: aws.String(`attachment; filename="a b.txt"`),
			ContentEncoding: aws.String("gzip"), ContentLanguage: aws.String("en-GB"), CacheControl: aws.String("max-age=60, private"),
			Expires: &exp, Metadata: map[string]string{"Foo": "Bar", "MixedCase": "Value 2", "k3": "v3"},
		})
		must(t, err, "PutObject")
		for _, via := range []string{"head", "get"} {
			var ct, cd, ce, cl, cc *string
			var md map[string]string
			var ex *time.Time
			if via == "head" {
				o, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key})
				must(t, err, "HeadObject")
				ct, cd, ce, cl, cc, md, ex = o.ContentType, o.ContentDisposition, o.ContentEncoding, o.ContentLanguage, o.CacheControl, o.Metadata, o.Expires
			} else {
				o, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
				must(t, err, "GetObject")
				sameBytes(t, "body", readAll(t, o.Body), data)
				ct, cd, ce, cl, cc, md, ex = o.ContentType, o.ContentDisposition, o.ContentEncoding, o.ContentLanguage, o.CacheControl, o.Metadata, o.Expires
			}
			check := func(what string, got *string, want string) {
				if aws.ToString(got) != want {
					t.Errorf("%s %s = %q, want %q", via, what, aws.ToString(got), want)
				}
			}
			check("Content-Type", ct, "text/x-test")
			check("Content-Disposition", cd, `attachment; filename="a b.txt"`)
			check("Content-Encoding (aws-chunked must never be stored)", ce, "gzip")
			check("Content-Language", cl, "en-GB")
			check("Cache-Control", cc, "max-age=60, private")
			want := map[string]string{"foo": "Bar", "mixedcase": "Value 2", "k3": "v3"}
			if len(md) != len(want) {
				t.Errorf("%s metadata %v, want %v", via, md, want)
			}
			for k, v := range want {
				if md[k] != v {
					t.Errorf("%s metadata[%q] = %q, want %q (all: %v)", via, k, md[k], v, md)
				}
			}
			if ex == nil || !ex.Equal(exp) {
				t.Errorf("%s Expires = %v, want %v", via, ex, exp)
			}
		}
	})

	t.Run("last_modified_is_recent", func(t *testing.T) {
		key := "lm/obj"
		before := time.Now().Add(-2 * time.Second)
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: strings.NewReader("x")})
		must(t, err, "PutObject")
		h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key})
		must(t, err, "HeadObject")
		lm := aws.ToTime(h.LastModified)
		if lm.Before(before) || lm.After(time.Now().Add(2*time.Second)) {
			t.Fatalf("LastModified %v is not within a few seconds of now (%v)", lm, time.Now())
		}
		if lm.Nanosecond() != 0 {
			t.Errorf("Last-Modified should have 1 s resolution, got %v", lm)
		}
	})

	t.Run("tagging_header_and_count", func(t *testing.T) {
		key := "tag/obj"
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: strings.NewReader("t"), Tagging: aws.String("k1=v1&k2=v%202")})
		must(t, err, "PutObject with Tagging")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
		must(t, err, "GetObject")
		_ = readAll(t, g.Body)
		if aws.ToInt32(g.TagCount) != 2 {
			t.Errorf("TagCount = %d, want 2", aws.ToInt32(g.TagCount))
		}
		tg, err := c.GetObjectTagging(ctx, &s3.GetObjectTaggingInput{Bucket: &b.Name, Key: &key})
		must(t, err, "GetObjectTagging")
		got := map[string]string{}
		for _, tag := range tg.TagSet {
			got[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
		}
		if len(got) != 2 || got["k1"] != "v1" || got["k2"] != "v 2" {
			t.Errorf("tags %v, want k1=v1 k2='v 2'", got)
		}
	})

	t.Run("nosuchkey_is_typed", func(t *testing.T) {
		_, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("does/not/exist")})
		var nsk *types.NoSuchKey
		if !errors.As(err, &nsk) {
			t.Fatalf("want *types.NoSuchKey, got %T: %v", err, err)
		}
		requireAPIError(t, err, "NoSuchKey", 404)
	})

	t.Run("head_missing_is_notfound", func(t *testing.T) {
		_, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("does/not/exist")})
		var nf *types.NotFound
		if !errors.As(err, &nf) {
			t.Fatalf("want *types.NotFound, got %T: %v", err, err)
		}
	})

	t.Run("delete_is_idempotent", func(t *testing.T) {
		for i := 0; i < 2; i++ {
			_, err := c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: aws.String("never/was/here")})
			must(t, err, fmt.Sprintf("DeleteObject of a missing key (attempt %d)", i+1))
		}
	})

	t.Run("missing_bucket_is_nosuchbucket", func(t *testing.T) {
		_, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String("bvt-go-no-such-bucket"), Key: aws.String("k")})
		requireAPIError(t, err, "NoSuchBucket", 404)
	})

	t.Run("request_ids_are_returned", func(t *testing.T) {
		out, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("rid"), Body: strings.NewReader("x")})
		must(t, err, "PutObject")
		if id, ok := awsmiddleware.GetRequestIDMetadata(out.ResultMetadata); !ok || id == "" {
			t.Errorf("no x-amz-request-id in the response metadata")
		}
	})
}
