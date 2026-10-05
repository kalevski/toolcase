package sdkgo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type oddKey struct{ ID, Key string }

// loadOddKeys reads the table shared by every client suite (test/conformance/support/oddkeys.json).
func loadOddKeys(t testing.TB) (keys []oddKey, tooLong string) {
	t.Helper()
	raw, err := os.ReadFile("../conformance/support/oddkeys.json")
	if err != nil {
		t.Fatalf("odd keys table: %v", err)
	}
	var doc struct {
		Keys []struct {
			ID  string `json:"id"`
			Key *string
			Gen *struct {
				Char  string `json:"char"`
				Count int    `json:"count"`
			} `json:"gen"`
		} `json:"keys"`
		TooLong struct {
			Char  string `json:"char"`
			Count int    `json:"count"`
		} `json:"too_long"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("odd keys table: %v", err)
	}
	for _, e := range doc.Keys {
		k := ""
		if e.Key != nil {
			k = *e.Key
		} else if e.Gen != nil {
			k = strings.Repeat(e.Gen.Char, e.Gen.Count)
		}
		keys = append(keys, oddKey{e.ID, k})
	}
	return keys, strings.Repeat(doc.TooLong.Char, doc.TooLong.Count)
}

func utf8Sorted(keys []string) []string {
	out := append([]string(nil), keys...)
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] }) // Go compares strings bytewise: UTF-8 order
	return out
}

func listAllKeys(t testing.TB, c *s3.Client, bucket string, in *s3.ListObjectsV2Input) []string {
	t.Helper()
	in.Bucket = &bucket
	in.EncodingType = types.EncodingTypeUrl
	var out []string
	p := s3.NewListObjectsV2Paginator(c, in)
	for p.HasMorePages() {
		page, err := p.NextPage(ctx)
		must(t, err, "ListObjectsV2")
		for _, o := range page.Contents {
			out = append(out, unescapeKey(t, aws.ToString(o.Key)))
		}
	}
	return out
}

func TestOddKeys(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	odd, tooLong := loadOddKeys(t)
	for _, style := range []string{"path", "virtual"} {
		style := style
		t.Run(style+"_style", func(t *testing.T) {
			t.Parallel()
			b := e.newBucket(t, "odd"+style[:1], nil)
			var opts []copt
			if style == "virtual" {
				opts = append(opts, withVirtual())
			}
			c := e.newClient(t, b, opts...)
			var all []string
			for _, k := range odd {
				k := k
				all = append(all, k.Key)
				t.Run(k.ID, func(t *testing.T) {
					body := []byte("body of " + k.ID)
					key := k.Key
					_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(body)})
					must(t, err, "PutObject")
					g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
					must(t, err, "GetObject")
					sameBytes(t, "body", readAll(t, g.Body), body)
					h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key})
					must(t, err, "HeadObject")
					if aws.ToInt64(h.ContentLength) != int64(len(body)) {
						t.Fatalf("HeadObject length %d", aws.ToInt64(h.ContentLength))
					}
					if style == "path" { // copy source is "bucket/key" in both styles; once is enough
						dst := "copy-of/" + k.ID
						_, err = c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: &dst, CopySource: aws.String(copySource(b.Name, key))})
						must(t, err, "CopyObject")
						g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &dst})
						must(t, err, "GetObject of the copy")
						sameBytes(t, "copy body", readAll(t, g.Body), body)
						_, err = c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: &dst})
						must(t, err, "DeleteObject of the copy")
					}
				})
			}
			t.Run("listing_in_utf8_byte_order", func(t *testing.T) {
				got := listAllKeys(t, c, b.Name, &s3.ListObjectsV2Input{})
				want := utf8Sorted(all)
				if fmt.Sprint(got) != fmt.Sprint(want) {
					t.Fatalf("listing differs from the UTF-8 byte order of the table:\n got %q\nwant %q", got, want)
				}
			})
			t.Run("delete_objects_with_every_key", func(t *testing.T) {
				var ids []types.ObjectIdentifier
				for _, k := range all {
					ids = append(ids, types.ObjectIdentifier{Key: aws.String(k)})
				}
				out, err := c.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: &b.Name, Delete: &types.Delete{Objects: ids}})
				must(t, err, "DeleteObjects")
				if len(out.Errors) != 0 || len(out.Deleted) != len(all) {
					t.Fatalf("deleted %d of %d, errors: %v", len(out.Deleted), len(all), out.Errors)
				}
				if left := listAllKeys(t, c, b.Name, &s3.ListObjectsV2Input{}); len(left) != 0 {
					t.Fatalf("keys left after DeleteObjects: %q", left)
				}
			})
		})
	}
	t.Run("key_longer_than_1024_bytes", func(t *testing.T) {
		b := e.newBucket(t, "toolong", nil)
		c := e.newClient(t, b)
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &tooLong, Body: strings.NewReader("x")})
		requireAPIError(t, err, "KeyTooLongError", 400)
	})
}

func TestListing(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "list", nil)
	c := e.newClient(t, b)
	var keys []string
	for i := 0; i < 2345; i++ {
		keys = append(keys, fmt.Sprintf("k/%05d", i))
	}
	keys = append(keys, "a.txt", "b.txt", "c/1", "c/2", "c/d/3", "e/1")
	putMany(t, c, b.Name, keys, 16)
	want := utf8Sorted(keys)

	t.Run("v2_paginator_walks_every_key", func(t *testing.T) {
		got := listAllKeys(t, c, b.Name, &s3.ListObjectsV2Input{})
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("got %d keys, want %d (first difference near %q)", len(got), len(want), firstDiff(got, want))
		}
	})
	t.Run("v2_page_sizes", func(t *testing.T) {
		p := s3.NewListObjectsV2Paginator(c, &s3.ListObjectsV2Input{Bucket: &b.Name})
		var sizes []int
		for p.HasMorePages() {
			page, err := p.NextPage(ctx)
			must(t, err, "ListObjectsV2")
			sizes = append(sizes, len(page.Contents))
		}
		if fmt.Sprint(sizes) != "[1000 1000 351]" {
			t.Fatalf("page sizes %v, want [1000 1000 351]", sizes)
		}
	})
	t.Run("v1_paginator_with_delimiter", func(t *testing.T) {
		in := &s3.ListObjectsInput{Bucket: &b.Name, Delimiter: aws.String("/"), MaxKeys: aws.Int32(2)}
		var contents, prefixes []string
		marker := ""
		for pages := 0; pages < 20; pages++ {
			if marker != "" {
				in.Marker = &marker
			}
			out, err := c.ListObjects(ctx, in)
			must(t, err, "ListObjects")
			for _, o := range out.Contents {
				contents = append(contents, aws.ToString(o.Key))
			}
			for _, p := range out.CommonPrefixes {
				prefixes = append(prefixes, aws.ToString(p.Prefix))
			}
			if !aws.ToBool(out.IsTruncated) {
				break
			}
			if out.NextMarker == nil {
				t.Fatalf("a truncated V1 listing with a delimiter must carry NextMarker")
			}
			marker = aws.ToString(out.NextMarker)
		}
		if fmt.Sprint(contents) != "[a.txt b.txt]" || fmt.Sprint(prefixes) != "[c/ e/ k/]" {
			t.Fatalf("contents %v prefixes %v", contents, prefixes)
		}
	})
	t.Run("prefix_and_delimiter", func(t *testing.T) {
		out, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name, Prefix: aws.String("c/"), Delimiter: aws.String("/")})
		must(t, err, "ListObjectsV2")
		var ks, ps []string
		for _, o := range out.Contents {
			ks = append(ks, aws.ToString(o.Key))
		}
		for _, p := range out.CommonPrefixes {
			ps = append(ps, aws.ToString(p.Prefix))
		}
		if fmt.Sprint(ks) != "[c/1 c/2]" || fmt.Sprint(ps) != "[c/d/]" || aws.ToInt32(out.KeyCount) != 3 {
			t.Fatalf("keys %v prefixes %v KeyCount %d", ks, ps, aws.ToInt32(out.KeyCount))
		}
	})
	t.Run("start_after_and_max_keys_zero", func(t *testing.T) {
		out, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name, StartAfter: aws.String("c/2"), MaxKeys: aws.Int32(3)})
		must(t, err, "ListObjectsV2")
		var ks []string
		for _, o := range out.Contents {
			ks = append(ks, aws.ToString(o.Key))
		}
		if fmt.Sprint(ks) != "[c/d/3 e/1 k/00000]" || !aws.ToBool(out.IsTruncated) {
			t.Fatalf("keys %v truncated %v", ks, aws.ToBool(out.IsTruncated))
		}
		out, err = c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name, MaxKeys: aws.Int32(0)})
		must(t, err, "ListObjectsV2 max-keys=0")
		if len(out.Contents) != 0 || aws.ToBool(out.IsTruncated) {
			t.Fatalf("max-keys=0 returned %d keys, truncated=%v", len(out.Contents), aws.ToBool(out.IsTruncated))
		}
	})
	t.Run("entry_fields", func(t *testing.T) {
		out, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name, Prefix: aws.String("a.txt"), FetchOwner: aws.Bool(true)})
		must(t, err, "ListObjectsV2")
		if len(out.Contents) != 1 {
			t.Fatalf("got %d entries", len(out.Contents))
		}
		o := out.Contents[0]
		if aws.ToInt64(o.Size) != 1 || o.StorageClass != types.ObjectStorageClassStandard || aws.ToString(o.ETag) != etagOf([]byte("x")) || o.LastModified == nil || o.Owner == nil {
			t.Fatalf("entry %+v", o)
		}
	})
	t.Run("invalid_max_keys", func(t *testing.T) {
		_, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name, MaxKeys: aws.Int32(-1)})
		requireAPIError(t, err, "InvalidArgument", 400)
	})
}

func firstDiff(got, want []string) string {
	for i := 0; i < len(got) && i < len(want); i++ {
		if got[i] != want[i] {
			return fmt.Sprintf("#%d got %q want %q", i, got[i], want[i])
		}
	}
	return fmt.Sprintf("length %d vs %d", len(got), len(want))
}

// putMany writes every key (body "x") with n workers.
func putMany(t testing.TB, c *s3.Client, bucket string, keys []string, n int) {
	t.Helper()
	jobs := make(chan string)
	errs := make(chan error, len(keys))
	for w := 0; w < n; w++ {
		go func() {
			for k := range jobs {
				_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &bucket, Key: aws.String(k), Body: strings.NewReader("x")})
				errs <- err
			}
		}()
	}
	go func() {
		for _, k := range keys {
			jobs <- k
		}
		close(jobs)
	}()
	for range keys {
		if err := <-errs; err != nil {
			t.Fatalf("PutObject: %v", err)
		}
	}
}
