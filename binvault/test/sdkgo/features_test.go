package sdkgo

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

func TestCopyAndTagging(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "copy", nil)
	c := e.newClient(t, b)
	src := "src dir/söurce+1%.txt"
	data := randBytes(3000)
	_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &src, Body: bytes.NewReader(data), ContentType: aws.String("text/x-src"), Metadata: map[string]string{"m": "1"}, Tagging: aws.String("a=1&b=2")})
	must(t, err, "PutObject")

	t.Run("copy_keeps_headers_metadata_and_tags", func(t *testing.T) {
		out, err := c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: aws.String("dst/c1"), CopySource: aws.String(copySource(b.Name, src))})
		must(t, err, "CopyObject")
		if out.CopyObjectResult == nil || aws.ToString(out.CopyObjectResult.ETag) != etagOf(data) || out.CopyObjectResult.LastModified == nil {
			t.Fatalf("CopyObjectResult %+v", out.CopyObjectResult)
		}
		h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("dst/c1")})
		must(t, err, "HeadObject")
		if aws.ToString(h.ContentType) != "text/x-src" || h.Metadata["m"] != "1" || aws.ToInt32(h.TagCount) != 2 {
			t.Fatalf("copy lost something: %+v", h)
		}
	})
	t.Run("replace_directives", func(t *testing.T) {
		_, err := c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: aws.String("dst/c2"), CopySource: aws.String(copySource(b.Name, src)),
			MetadataDirective: types.MetadataDirectiveReplace, ContentType: aws.String("text/x-new"), Metadata: map[string]string{"n": "2"},
			TaggingDirective: types.TaggingDirectiveReplace, Tagging: aws.String("z=26")})
		must(t, err, "CopyObject")
		h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("dst/c2")})
		must(t, err, "HeadObject")
		if aws.ToString(h.ContentType) != "text/x-new" || h.Metadata["n"] != "2" || len(h.Metadata) != 1 || aws.ToInt32(h.TagCount) != 1 {
			t.Fatalf("%+v", h)
		}
	})
	t.Run("conditional_copy", func(t *testing.T) {
		_, err := c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: aws.String("dst/c3"), CopySource: aws.String(copySource(b.Name, src)), CopySourceIfMatch: aws.String(`"deadbeef"`)})
		requireAPIError(t, err, "PreconditionFailed", 412)
		_, err = c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: aws.String("dst/c3"), CopySource: aws.String(copySource(b.Name, src)), CopySourceIfMatch: aws.String(etagOf(data))})
		must(t, err, "CopyObject with a matching If-Match")
	})
	t.Run("self_copy_is_invalid", func(t *testing.T) {
		_, err := c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: &src, CopySource: aws.String(copySource(b.Name, src))})
		requireAPIError(t, err, "InvalidRequest", 400)
	})
	t.Run("copy_from_another_bucket_is_denied", func(t *testing.T) {
		other := e.newBucket(t, "copyother", nil)
		oc := e.newClient(t, other)
		_, err := oc.PutObject(ctx, &s3.PutObjectInput{Bucket: &other.Name, Key: aws.String("o"), Body: strings.NewReader("o")})
		must(t, err, "PutObject")
		_, err = c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: aws.String("x"), CopySource: aws.String(copySource(other.Name, "o"))})
		requireAPIError(t, err, "AccessDenied", 403)
	})
	t.Run("missing_source", func(t *testing.T) {
		_, err := c.CopyObject(ctx, &s3.CopyObjectInput{Bucket: &b.Name, Key: aws.String("x"), CopySource: aws.String(copySource(b.Name, "nope"))})
		requireAPIError(t, err, "NoSuchKey", 404)
	})
	t.Run("tagging_api", func(t *testing.T) {
		key := "tag/obj"
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: strings.NewReader("t")})
		must(t, err, "PutObject")
		_, err = c.PutObjectTagging(ctx, &s3.PutObjectTaggingInput{Bucket: &b.Name, Key: &key, Tagging: &types.Tagging{TagSet: []types.Tag{{Key: aws.String("env"), Value: aws.String("prod")}, {Key: aws.String("sp ace"), Value: aws.String("v+w")}}}})
		must(t, err, "PutObjectTagging")
		g, err := c.GetObjectTagging(ctx, &s3.GetObjectTaggingInput{Bucket: &b.Name, Key: &key})
		must(t, err, "GetObjectTagging")
		if len(g.TagSet) != 2 {
			t.Fatalf("tags %+v", g.TagSet)
		}
		var tooMany []types.Tag
		for i := 0; i < 11; i++ {
			tooMany = append(tooMany, types.Tag{Key: aws.String(fmt.Sprintf("k%d", i)), Value: aws.String("v")})
		}
		_, err = c.PutObjectTagging(ctx, &s3.PutObjectTaggingInput{Bucket: &b.Name, Key: &key, Tagging: &types.Tagging{TagSet: tooMany}})
		requireAPIError(t, err, "InvalidTag", 400)
		_, err = c.DeleteObjectTagging(ctx, &s3.DeleteObjectTaggingInput{Bucket: &b.Name, Key: &key})
		must(t, err, "DeleteObjectTagging")
		g, err = c.GetObjectTagging(ctx, &s3.GetObjectTaggingInput{Bucket: &b.Name, Key: &key})
		must(t, err, "GetObjectTagging")
		if len(g.TagSet) != 0 {
			t.Fatalf("tags after delete: %+v", g.TagSet)
		}
	})
}

func TestDeleteObjectsAndConditionals(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "del", nil)
	c := e.newClient(t, b)
	var keys []string
	for i := 0; i < 1500; i++ {
		keys = append(keys, fmt.Sprintf("d/%04d", i))
	}
	putMany(t, c, b.Name, keys, 16)

	t.Run("delete_a_thousand_and_a_remainder", func(t *testing.T) {
		del := func(ks []string, quiet bool) *s3.DeleteObjectsOutput {
			var ids []types.ObjectIdentifier
			for _, k := range ks {
				ids = append(ids, types.ObjectIdentifier{Key: aws.String(k)})
			}
			out, err := c.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: &b.Name, Delete: &types.Delete{Objects: ids, Quiet: aws.Bool(quiet)}})
			must(t, err, "DeleteObjects")
			return out
		}
		out := del(keys[:1000], false)
		if len(out.Deleted) != 1000 || len(out.Errors) != 0 {
			t.Fatalf("deleted %d errors %d", len(out.Deleted), len(out.Errors))
		}
		out = del(keys[1000:], true)
		if len(out.Deleted) != 0 || len(out.Errors) != 0 {
			t.Fatalf("quiet mode returned %d deleted, %d errors", len(out.Deleted), len(out.Errors))
		}
		if left := listAllKeys(t, c, b.Name, &s3.ListObjectsV2Input{}); len(left) != 0 {
			t.Fatalf("%d keys left", len(left))
		}
	})
	t.Run("a_thousand_and_one_keys_are_malformedxml", func(t *testing.T) {
		var ids []types.ObjectIdentifier
		for i := 0; i < 1001; i++ {
			ids = append(ids, types.ObjectIdentifier{Key: aws.String(fmt.Sprintf("x%d", i))})
		}
		_, err := c.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: &b.Name, Delete: &types.Delete{Objects: ids}})
		requireAPIError(t, err, "MalformedXML", 400)
	})
	t.Run("conditional_writes", func(t *testing.T) {
		key := aws.String("cond/obj")
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: key, Body: strings.NewReader("one"), IfNoneMatch: aws.String("*")})
		must(t, err, "create-only PutObject")
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: key, Body: strings.NewReader("two"), IfNoneMatch: aws.String("*")})
		requireAPIError(t, err, "PreconditionFailed", 412)
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: key, Body: strings.NewReader("three"), IfMatch: aws.String(`"nope"`)})
		requireAPIError(t, err, "PreconditionFailed", 412)
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: key, Body: strings.NewReader("four"), IfMatch: aws.String(etagOf([]byte("one")))})
		must(t, err, "compare-and-swap PutObject")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key})
		must(t, err, "GetObject")
		if string(readAll(t, g.Body)) != "four" {
			t.Fatalf("content after the swap")
		}
		_, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key, IfNoneMatch: aws.String(etagOf([]byte("four")))})
		var re interface{ HTTPStatusCode() int }
		if !errors.As(err, &re) || re.HTTPStatusCode() != 304 {
			t.Fatalf("GetObject If-None-Match: want a 304 error, got %v", err)
		}
	})
	t.Run("response_header_overrides", func(t *testing.T) {
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("ovr"), Body: strings.NewReader("o")})
		must(t, err, "PutObject")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("ovr"), ResponseContentType: aws.String("image/png"), ResponseContentDisposition: aws.String("inline"), ResponseContentLanguage: aws.String("fr"), ResponseCacheControl: aws.String("no-cache")})
		must(t, err, "GetObject")
		_ = readAll(t, g.Body)
		if aws.ToString(g.ContentType) != "image/png" || aws.ToString(g.ContentDisposition) != "inline" || aws.ToString(g.ContentLanguage) != "fr" || aws.ToString(g.CacheControl) != "no-cache" {
			t.Fatalf("%+v", g)
		}
	})
}

func TestVersioningAndEncryption(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "ver", map[string]any{"versioning": "enabled", "encryption": "sse-s3"})
	c := e.newClient(t, b)
	key := aws.String("v/key")
	var vids []string
	for i := 0; i < 4; i++ {
		out, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: key, Body: strings.NewReader(fmt.Sprintf("version %d", i))})
		must(t, err, "PutObject")
		if aws.ToString(out.VersionId) == "" || out.ServerSideEncryption != types.ServerSideEncryptionAes256 {
			t.Fatalf("PutObject: version %q sse %q", aws.ToString(out.VersionId), out.ServerSideEncryption)
		}
		vids = append(vids, aws.ToString(out.VersionId))
	}
	t.Run("get_by_version", func(t *testing.T) {
		for i, v := range vids {
			g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key, VersionId: aws.String(v)})
			must(t, err, "GetObject")
			if string(readAll(t, g.Body)) != fmt.Sprintf("version %d", i) || aws.ToString(g.VersionId) != v {
				t.Fatalf("version %d", i)
			}
		}
	})
	t.Run("list_object_versions_paginator", func(t *testing.T) {
		p := s3.NewListObjectVersionsPaginator(c, &s3.ListObjectVersionsInput{Bucket: &b.Name, MaxKeys: aws.Int32(3)})
		var seen []string
		pages := 0
		for p.HasMorePages() {
			page, err := p.NextPage(ctx)
			must(t, err, "ListObjectVersions")
			pages++
			for _, v := range page.Versions {
				seen = append(seen, aws.ToString(v.VersionId))
			}
		}
		want := []string{vids[3], vids[2], vids[1], vids[0]} // newest first
		if fmt.Sprint(seen) != fmt.Sprint(want) || pages != 2 {
			t.Fatalf("versions %v in %d pages, want %v in 2", seen, pages, want)
		}
	})
	t.Run("delete_marker_and_purge", func(t *testing.T) {
		del, err := c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: key})
		must(t, err, "DeleteObject")
		if !aws.ToBool(del.DeleteMarker) || aws.ToString(del.VersionId) == "" {
			t.Fatalf("expected a delete marker, got %+v", del)
		}
		_, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key})
		var nsk *types.NoSuchKey
		if !errors.As(err, &nsk) {
			t.Fatalf("GetObject of a deleted key: %T %v", err, err)
		}
		_, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key, VersionId: del.VersionId})
		requireAPIError(t, err, "MethodNotAllowed", 405)
		_, err = c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: key, VersionId: del.VersionId}) // purge the marker: the key is back
		must(t, err, "purging the delete marker")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key})
		must(t, err, "GetObject after the marker was purged")
		if string(readAll(t, g.Body)) != "version 3" {
			t.Fatalf("latest after purge")
		}
		_, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: key, VersionId: aws.String("01JNOSUCHVERSIONXXXXXXXXXX")})
		requireAPIError(t, err, "NoSuchVersion", 404)
	})
	t.Run("encryption_is_reported_and_transparent", func(t *testing.T) {
		data := randBytes(300 * KiB)
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("enc/blob"), Body: bytes.NewReader(data)})
		must(t, err, "PutObject")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("enc/blob"), Range: aws.String("bytes=65530-65545")})
		must(t, err, "ranged GetObject")
		sameBytes(t, "range across a 64 KiB chunk boundary", readAll(t, g.Body), data[65530:65546])
		if g.ServerSideEncryption != types.ServerSideEncryptionAes256 {
			t.Errorf("ServerSideEncryption %q", g.ServerSideEncryption)
		}
		enc, err := c.GetBucketEncryption(ctx, &s3.GetBucketEncryptionInput{Bucket: &b.Name})
		must(t, err, "GetBucketEncryption")
		if enc.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm != types.ServerSideEncryptionAes256 {
			t.Errorf("%+v", enc.ServerSideEncryptionConfiguration)
		}
		ver, err := c.GetBucketVersioning(ctx, &s3.GetBucketVersioningInput{Bucket: &b.Name})
		must(t, err, "GetBucketVersioning")
		if ver.Status != types.BucketVersioningStatusEnabled {
			t.Errorf("versioning %q", ver.Status)
		}
	})
	t.Run("kms_and_sse_c_are_not_implemented", func(t *testing.T) {
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("kms"), Body: strings.NewReader("x"), ServerSideEncryption: types.ServerSideEncryptionAwsKms})
		requireAPIError(t, err, "NotImplemented", 501)
		_, err = c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("ssec"), Body: strings.NewReader("x"), SSECustomerAlgorithm: aws.String("AES256"),
			SSECustomerKey: aws.String("0123456789abcdef0123456789abcdef"), SSECustomerKeyMD5: aws.String("")})
		if err == nil {
			t.Fatalf("SSE-C must be refused")
		}
	})
}

func TestBucketLevelAndAuth(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "auth", nil)
	c := e.newClient(t, b)
	_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("k"), Body: strings.NewReader("v")})
	must(t, err, "PutObject")

	t.Run("bucket_operations", func(t *testing.T) {
		if _, err := c.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &b.Name}); err != nil {
			t.Fatalf("HeadBucket: %v", err)
		}
		lb, err := c.ListBuckets(ctx, &s3.ListBucketsInput{})
		must(t, err, "ListBuckets")
		if len(lb.Buckets) != 1 || aws.ToString(lb.Buckets[0].Name) != b.Name || lb.Buckets[0].CreationDate == nil {
			t.Fatalf("ListBuckets %+v", lb.Buckets)
		}
		loc, err := c.GetBucketLocation(ctx, &s3.GetBucketLocationInput{Bucket: &b.Name})
		must(t, err, "GetBucketLocation")
		if loc.LocationConstraint != "" {
			t.Errorf("LocationConstraint %q, want empty for us-east-1", loc.LocationConstraint)
		}
		if _, err := c.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &b.Name}); err != nil {
			t.Fatalf("CreateBucket of the token's own bucket must succeed: %v", err)
		}
		_, err = c.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: &b.Name})
		requireAPIError(t, err, "AccessDenied", 403)
		_, err = c.PutBucketVersioning(ctx, &s3.PutBucketVersioningInput{Bucket: &b.Name, VersioningConfiguration: &types.VersioningConfiguration{Status: types.BucketVersioningStatusEnabled}})
		requireAPIError(t, err, "AccessDenied", 403)
		_, err = c.GetBucketLifecycleConfiguration(ctx, &s3.GetBucketLifecycleConfigurationInput{Bucket: &b.Name})
		requireAPIError(t, err, "NoSuchLifecycleConfiguration", 404)
		acl, err := c.GetBucketAcl(ctx, &s3.GetBucketAclInput{Bucket: &b.Name})
		must(t, err, "GetBucketAcl")
		if len(acl.Grants) != 1 || acl.Grants[0].Permission != types.PermissionFullControl {
			t.Fatalf("GetBucketAcl %+v", acl.Grants)
		}
		_, err = c.PutObjectAcl(ctx, &s3.PutObjectAclInput{Bucket: &b.Name, Key: aws.String("k"), ACL: types.ObjectCannedACLPublicRead})
		requireAPIError(t, err, "AccessControlListNotSupported", 400)
	})
	t.Run("wrong_secret_and_unknown_key", func(t *testing.T) {
		bad := b
		bad.SecretKey = strings.Repeat("x", 40)
		_, err := e.newClient(t, bad).GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("k")})
		requireAPIError(t, err, "SignatureDoesNotMatch", 403)
		bad = b
		bad.AccessKey = "BVKAAAAAAAAAAAAAAAAA"
		_, err = e.newClient(t, bad).GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("k")})
		requireAPIError(t, err, "InvalidAccessKeyId", 403)
	})
	t.Run("read_only_token", func(t *testing.T) {
		ro := e.newClient(t, e.newToken(t, b.Name, []any{map[string]any{"actions": []string{"read", "list"}}}, nil))
		g, err := ro.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("k")})
		must(t, err, "GetObject")
		_ = readAll(t, g.Body)
		_, err = ro.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("new"), Body: strings.NewReader("x")})
		requireAPIError(t, err, "AccessDenied", 403)
		_, err = ro.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &b.Name, Key: aws.String("k")})
		requireAPIError(t, err, "AccessDenied", 403)
	})
	t.Run("prefix_restricted_token", func(t *testing.T) {
		pc := e.newClient(t, e.newToken(t, b.Name, []any{map[string]any{"actions": []string{"read", "write", "list"}, "keys": []string{"mine/*"}}}, nil))
		_, err := pc.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("mine/a"), Body: strings.NewReader("x")})
		must(t, err, "PutObject inside the pattern")
		_, err = pc.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("theirs/a"), Body: strings.NewReader("x")})
		requireAPIError(t, err, "AccessDenied", 403)
		_, err = pc.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name})
		requireAPIError(t, err, "AccessDenied", 403)
		out, err := pc.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name, Prefix: aws.String("mine/")})
		must(t, err, "ListObjectsV2 inside the pattern")
		if len(out.Contents) != 1 {
			t.Fatalf("%d keys", len(out.Contents))
		}
	})
	t.Run("anonymous_requests", func(t *testing.T) {
		pub := e.newBucket(t, "authpub", map[string]any{"anonymous_read": "objects"})
		pc := e.newClient(t, pub)
		_, err := pc.PutObject(ctx, &s3.PutObjectInput{Bucket: &pub.Name, Key: aws.String("pub.txt"), Body: strings.NewReader("public")})
		must(t, err, "PutObject")
		anon := e.newClient(t, pub, withAnonymous())
		g, err := anon.GetObject(ctx, &s3.GetObjectInput{Bucket: &pub.Name, Key: aws.String("pub.txt")})
		must(t, err, "anonymous GetObject")
		if string(readAll(t, g.Body)) != "public" {
			t.Fatalf("body")
		}
		_, err = anon.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &pub.Name})
		requireAPIError(t, err, "AccessDenied", 403)
		_, err = anon.PutObject(ctx, &s3.PutObjectInput{Bucket: &pub.Name, Key: aws.String("x"), Body: strings.NewReader("x")})
		requireAPIError(t, err, "AccessDenied", 403)
		_, err = e.newClient(t, b, withAnonymous()).GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("k")})
		requireAPIError(t, err, "AccessDenied", 403)
	})
	t.Run("any_region_is_accepted", func(t *testing.T) {
		for _, region := range []string{"eu-central-1", "auto", "ap-northeast-3"} {
			rc := e.newClient(t, b, withRegion(region))
			g, err := rc.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("k")})
			if err != nil {
				t.Fatalf("region %s: %v", region, err)
			}
			_ = readAll(t, g.Body)
		}
	})
}

func TestVirtualHostedStyle(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "vh", nil)
	c := e.newClient(t, b, withVirtual())
	_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("_next/app.js"), Body: strings.NewReader("js"), ContentType: aws.String("text/javascript")})
	must(t, err, "PutObject of a key that starts with an underscore")
	g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("_next/app.js")})
	must(t, err, "GetObject")
	if string(readAll(t, g.Body)) != "js" {
		t.Fatalf("body")
	}
	out, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &b.Name})
	must(t, err, "ListObjectsV2")
	if len(out.Contents) != 1 || aws.ToString(out.Contents[0].Key) != "_next/app.js" {
		t.Fatalf("%+v", out.Contents)
	}
	if _, err := c.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &b.Name}); err != nil {
		t.Fatalf("HeadBucket: %v", err)
	}
	data := randBytes(11 * MiB)
	_, err = manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 5 * MiB }).Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("mp"), Body: bytes.NewReader(data)})
	must(t, err, "multipart upload")
	g, err = c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("mp")})
	must(t, err, "GetObject")
	sameBytes(t, "multipart object", readAll(t, g.Body), data)
}

func TestRetriesHonourSlowDown(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "slow", map[string]any{"limits": map[string]any{"requests_per_second": 5, "burst": 5}})
	var attempts atomic.Int32
	rec := &recorder{}
	c := e.newClient(t, b, withRecorder(rec), withRetryer(func() aws.Retryer {
		return retry.NewStandard(func(o *retry.StandardOptions) {
			o.MaxAttempts = 12
			o.RateLimiter = ratelimit.None
			o.Backoff = retry.NewExponentialJitterBackoff(300 * time.Millisecond)
		})
	}))
	_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("k"), Body: strings.NewReader("payload")})
	must(t, err, "PutObject")
	start := time.Now()
	for i := 0; i < 20; i++ {
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("k")})
		must(t, err, fmt.Sprintf("GetObject #%d (the standard retryer must ride out SlowDown)", i))
		_ = readAll(t, g.Body)
		attempts.Add(1)
	}
	if time.Since(start) < 2*time.Second {
		t.Errorf("20 requests at 5/s finished in %v", time.Since(start))
	}
	saw503 := 0
	for _, w := range rec.all() {
		if w.Status == http.StatusServiceUnavailable {
			saw503++
			if w.RespHeader.Get("Retry-After") == "" {
				t.Errorf("a 503 SlowDown without Retry-After")
			}
		}
	}
	if saw503 == 0 {
		t.Errorf("the limit never triggered")
	}
}
