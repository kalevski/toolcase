package sdkgo

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	tmtypes "github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

func splitParts(data []byte, size int) [][]byte {
	var out [][]byte
	for i := 0; i < len(data); i += size {
		out = append(out, data[i:min(len(data), i+size)])
	}
	return out
}

func TestManagerUploader(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "uploader", nil)
	rec := &recorder{}
	c := e.newClient(t, b, withRecorder(rec))

	t.Run("multipart_21mib_8mib_parts", func(t *testing.T) {
		data := randBytes(21*MiB + 17)
		up := manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 8 * MiB; u.Concurrency = 4 })
		out, err := up.Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("big/21m.bin"), Body: bytes.NewReader(data),
			ContentType: aws.String("application/x-big"), Metadata: map[string]string{"origin": "uploader"}, Tagging: aws.String("t=1")})
		must(t, err, "Upload")
		if out.UploadID == "" || len(out.CompletedParts) != 3 {
			t.Fatalf("expected a multipart upload with 3 parts, got UploadID=%q parts=%d", out.UploadID, len(out.CompletedParts))
		}
		want := multipartETag(splitParts(data, 8*MiB)...)
		if aws.ToString(out.ETag) != want {
			t.Fatalf("ETag %q, want %q", aws.ToString(out.ETag), want)
		}
		h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("big/21m.bin"), ChecksumMode: types.ChecksumModeEnabled})
		must(t, err, "HeadObject")
		if aws.ToInt64(h.ContentLength) != int64(len(data)) || aws.ToString(h.ContentType) != "application/x-big" || h.Metadata["origin"] != "uploader" || aws.ToInt32(h.PartsCount) != 0 && aws.ToInt32(h.PartsCount) != 3 {
			t.Fatalf("HeadObject %+v", h)
		}
		if aws.ToString(h.ChecksumCRC32) == "" || !strings.HasSuffix(aws.ToString(h.ChecksumCRC32), "-3") {
			t.Errorf("the default CRC32 of a 3-part upload must be a composite value ending in -3, got %q", aws.ToString(h.ChecksumCRC32))
		}
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("big/21m.bin")})
		must(t, err, "GetObject")
		sameBytes(t, "object", readAll(t, g.Body), data)
	})

	t.Run("small_body_is_a_single_put", func(t *testing.T) {
		up := manager.NewUploader(c)
		out, err := up.Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("small"), Body: strings.NewReader("tiny")})
		must(t, err, "Upload")
		if out.UploadID != "" || aws.ToString(out.ETag) != etagOf([]byte("tiny")) {
			t.Fatalf("UploadID=%q ETag=%q", out.UploadID, aws.ToString(out.ETag))
		}
	})

	t.Run("stream_of_unknown_length", func(t *testing.T) {
		data := randBytes(13*MiB + 5)
		up := manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 5 * MiB; u.Concurrency = 3 })
		out, err := up.Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("stream"), Body: io.MultiReader(bytes.NewReader(data))})
		must(t, err, "Upload of a non-seekable reader")
		if aws.ToString(out.ETag) != multipartETag(splitParts(data, 5*MiB)...) {
			t.Fatalf("ETag %q", aws.ToString(out.ETag))
		}
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("stream")})
		must(t, err, "GetObject")
		sameBytes(t, "stream object", readAll(t, g.Body), data)
	})

	for _, alg := range allChecksumAlgs {
		alg := alg
		t.Run("checksum_"+string(alg), func(t *testing.T) {
			data := randBytes(11 * MiB)
			key := "ck/" + string(alg)
			up := manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 5 * MiB })
			_, err := up.Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(data), ChecksumAlgorithm: alg})
			must(t, err, "Upload with ChecksumAlgorithm "+string(alg))
			h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: &key, ChecksumMode: types.ChecksumModeEnabled})
			must(t, err, "HeadObject")
			got := map[types.ChecksumAlgorithm]*string{types.ChecksumAlgorithmCrc32: h.ChecksumCRC32, types.ChecksumAlgorithmCrc32c: h.ChecksumCRC32C,
				types.ChecksumAlgorithmSha1: h.ChecksumSHA1, types.ChecksumAlgorithmSha256: h.ChecksumSHA256, types.ChecksumAlgorithmCrc64nvme: h.ChecksumCRC64NVME}[alg]
			if aws.ToString(got) == "" {
				t.Fatalf("no %s checksum on the object", alg)
			}
			if alg == types.ChecksumAlgorithmCrc64nvme {
				if aws.ToString(got) != checksumB64(alg, data) {
					t.Errorf("CRC64NVME is a full-object checksum: %q != %q", aws.ToString(got), checksumB64(alg, data))
				}
			} else if !strings.HasSuffix(aws.ToString(got), "-3") {
				t.Errorf("%s of a 3-part upload is composite (…-3), got %q", alg, aws.ToString(got))
			}
		})
	}

	t.Run("failed_upload_leaves_no_open_multipart_upload", func(t *testing.T) {
		boom := errors.New("source died")
		r := io.MultiReader(bytes.NewReader(randBytes(11*MiB)), &failingReader{boom})
		up := manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 5 * MiB; u.Concurrency = 2 })
		_, err := up.Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("never/finished"), Body: r})
		if err == nil {
			t.Fatalf("the upload must fail")
		}
		out, lerr := c.ListMultipartUploads(ctx, &s3.ListMultipartUploadsInput{Bucket: &b.Name, Prefix: aws.String("never/")})
		must(t, lerr, "ListMultipartUploads")
		if len(out.Uploads) != 0 {
			t.Fatalf("the uploader aborts a failed upload; %d uploads are still open", len(out.Uploads))
		}
		_, herr := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("never/finished")})
		if herr == nil {
			t.Fatalf("a failed upload must not create the object")
		}
	})
}

type failingReader struct{ err error }

func (f *failingReader) Read([]byte) (int, error) { return 0, f.err }

func TestManagerDownloader(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "downloader", nil)
	c := e.newClient(t, b)
	data := randBytes(23*MiB + 99)
	_, err := manager.NewUploader(c, func(u *manager.Uploader) { u.PartSize = 8 * MiB }).Upload(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("big"), Body: bytes.NewReader(data)})
	must(t, err, "Upload")

	for _, ps := range []int64{5 * MiB, 7*MiB + 1, 16 * MiB} {
		ps := ps
		t.Run(fmt.Sprintf("ranged_parts_%d", ps), func(t *testing.T) {
			buf := manager.NewWriteAtBuffer(nil)
			n, err := manager.NewDownloader(c, func(d *manager.Downloader) { d.PartSize = ps; d.Concurrency = 4 }).Download(ctx, buf, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("big")})
			must(t, err, "Download")
			if n != int64(len(data)) {
				t.Fatalf("downloaded %d bytes, want %d", n, len(data))
			}
			sameBytes(t, "object", buf.Bytes(), data)
		})
	}
	t.Run("explicit_range", func(t *testing.T) {
		buf := manager.NewWriteAtBuffer(nil)
		_, err := manager.NewDownloader(c, func(d *manager.Downloader) { d.PartSize = 5 * MiB }).Download(ctx, buf,
			&s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("big"), Range: aws.String("bytes=1000000-12000000")})
		must(t, err, "Download with a range")
		sameBytes(t, "range", buf.Bytes(), data[1000000:12000001])
	})
	t.Run("small_object_and_empty_object", func(t *testing.T) {
		for _, size := range []int{0, 1, 100} {
			key := fmt.Sprintf("small%d", size)
			d := randBytes(size)
			_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: &key, Body: bytes.NewReader(d)})
			must(t, err, "PutObject")
			buf := manager.NewWriteAtBuffer(nil)
			n, err := manager.NewDownloader(c).Download(ctx, buf, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
			must(t, err, "Download")
			if n != int64(size) {
				t.Fatalf("size %d: downloaded %d bytes", size, n)
			}
			sameBytes(t, key, buf.Bytes(), d)
		}
	})
	t.Run("missing_key", func(t *testing.T) {
		_, err := manager.NewDownloader(c).Download(ctx, manager.NewWriteAtBuffer(nil), &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("nope")})
		requireAPIError(t, err, "NoSuchKey", 404)
	})
}

func TestTransferManager(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "tm", nil)
	c := e.newClient(t, b)
	tm := transfermanager.New(c, func(o *transfermanager.Options) {
		o.PartSizeBytes = 5 * MiB
		o.MultipartUploadThreshold = 5 * MiB
		o.Concurrency = 4
	})
	data := randBytes(17*MiB + 3)

	t.Run("upload_object_multipart", func(t *testing.T) {
		out, err := tm.UploadObject(ctx, &transfermanager.UploadObjectInput{Bucket: &b.Name, Key: aws.String("tm/big"), Body: bytes.NewReader(data), ContentType: aws.String("application/x-tm")})
		must(t, err, "UploadObject")
		if aws.ToString(out.ETag) != multipartETag(splitParts(data, 5*MiB)...) {
			t.Fatalf("ETag %q", aws.ToString(out.ETag))
		}
		h, err := c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &b.Name, Key: aws.String("tm/big")})
		must(t, err, "HeadObject")
		if aws.ToInt64(h.ContentLength) != int64(len(data)) || aws.ToString(h.ContentType) != "application/x-tm" {
			t.Fatalf("HeadObject %+v", h)
		}
	})
	t.Run("upload_object_single_put", func(t *testing.T) {
		out, err := tm.UploadObject(ctx, &transfermanager.UploadObjectInput{Bucket: &b.Name, Key: aws.String("tm/small"), Body: strings.NewReader("small via tm")})
		must(t, err, "UploadObject")
		if aws.ToString(out.ETag) != etagOf([]byte("small via tm")) {
			t.Fatalf("ETag %q", aws.ToString(out.ETag))
		}
	})
	for _, typ := range []tmtypes.GetObjectType{tmtypes.GetObjectRanges, tmtypes.GetObjectParts} {
		typ := typ
		t.Run("download_object_"+string(typ), func(t *testing.T) {
			buf := tmtypes.NewWriteAtBuffer(nil)
			_, err := tm.DownloadObject(ctx, &transfermanager.DownloadObjectInput{Bucket: &b.Name, Key: aws.String("tm/big"), WriterAt: buf}, func(o *transfermanager.Options) { o.GetObjectType = typ })
			must(t, err, "DownloadObject")
			sameBytes(t, "object", buf.Bytes(), data)
		})
		t.Run("get_object_streaming_"+string(typ), func(t *testing.T) {
			out, err := tm.GetObject(ctx, &transfermanager.GetObjectInput{Bucket: &b.Name, Key: aws.String("tm/big")}, func(o *transfermanager.Options) { o.GetObjectType = typ })
			must(t, err, "GetObject")
			got, err := io.ReadAll(out.Body)
			must(t, err, "reading the stream")
			sameBytes(t, "object", got, data)
		})
	}
	t.Run("directory_roundtrip", func(t *testing.T) {
		dir := t.TempDir()
		files := map[string][]byte{"a.txt": []byte("a"), "sub/b.bin": randBytes(2000), "sub/deeper/c": randBytes(300000), "with space/d e.txt": []byte("spaced")}
		for rel, d := range files {
			writeFile(t, dir+"/"+rel, d)
		}
		_, err := tm.UploadDirectory(ctx, &transfermanager.UploadDirectoryInput{Bucket: &b.Name, Source: &dir, Recursive: aws.Bool(true), KeyPrefix: aws.String("dir")})
		must(t, err, "UploadDirectory")
		listed := listAllKeys(t, c, b.Name, &s3.ListObjectsV2Input{Prefix: aws.String("dir")})
		if len(listed) != len(files) {
			t.Fatalf("listed %v", listed)
		}
		for rel := range files {
			found := false
			for _, k := range listed {
				found = found || k == "dir/"+rel
			}
			if !found {
				t.Errorf("dir/%s is not in the bucket: %v", rel, listed)
			}
		}
		dst := t.TempDir()
		_, err = tm.DownloadDirectory(ctx, &transfermanager.DownloadDirectoryInput{Bucket: &b.Name, Destination: &dst, KeyPrefix: aws.String("dir")})
		must(t, err, "DownloadDirectory")
		for rel, d := range files {
			sameBytes(t, rel, readFile(t, dst+"/"+rel), d)
		}
	})
}

func TestMultipartLowLevel(t *testing.T) {
	e := needEnv(t)
	t.Parallel()
	b := e.newBucket(t, "mplow", nil)
	c := e.newClient(t, b)
	key := "low/obj"
	parts := [][]byte{randBytes(5 * MiB), randBytes(5*MiB + 3), randBytes(1234)}

	create, err := c.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{Bucket: &b.Name, Key: &key, ContentType: aws.String("text/x-mp"), Metadata: map[string]string{"k": "v"},
		ChecksumAlgorithm: types.ChecksumAlgorithmSha256})
	must(t, err, "CreateMultipartUpload")
	uid := create.UploadId
	var done []types.CompletedPart
	for i, p := range parts {
		n := int32(i + 1)
		out, err := c.UploadPart(ctx, &s3.UploadPartInput{Bucket: &b.Name, Key: &key, UploadId: uid, PartNumber: &n, Body: bytes.NewReader(p), ChecksumAlgorithm: types.ChecksumAlgorithmSha256})
		must(t, err, fmt.Sprintf("UploadPart %d", n))
		if aws.ToString(out.ETag) != etagOf(p) || aws.ToString(out.ChecksumSHA256) != checksumB64(types.ChecksumAlgorithmSha256, p) {
			t.Fatalf("part %d: ETag %q checksum %q", n, aws.ToString(out.ETag), aws.ToString(out.ChecksumSHA256))
		}
		done = append(done, types.CompletedPart{ETag: out.ETag, PartNumber: &n, ChecksumSHA256: out.ChecksumSHA256})
	}

	t.Run("list_parts_and_uploads", func(t *testing.T) {
		lp, err := c.ListParts(ctx, &s3.ListPartsInput{Bucket: &b.Name, Key: &key, UploadId: uid, MaxParts: aws.Int32(2)})
		must(t, err, "ListParts")
		if len(lp.Parts) != 2 || !aws.ToBool(lp.IsTruncated) || aws.ToString(lp.NextPartNumberMarker) != "2" {
			t.Fatalf("ListParts page 1: %d parts truncated=%v next=%q", len(lp.Parts), aws.ToBool(lp.IsTruncated), aws.ToString(lp.NextPartNumberMarker))
		}
		lp2, err := c.ListParts(ctx, &s3.ListPartsInput{Bucket: &b.Name, Key: &key, UploadId: uid, PartNumberMarker: lp.NextPartNumberMarker})
		must(t, err, "ListParts page 2")
		if len(lp2.Parts) != 1 || aws.ToInt32(lp2.Parts[0].PartNumber) != 3 || aws.ToInt64(lp2.Parts[0].Size) != int64(len(parts[2])) {
			t.Fatalf("ListParts page 2: %+v", lp2.Parts)
		}
		lu, err := c.ListMultipartUploads(ctx, &s3.ListMultipartUploadsInput{Bucket: &b.Name})
		must(t, err, "ListMultipartUploads")
		if len(lu.Uploads) != 1 || aws.ToString(lu.Uploads[0].UploadId) != aws.ToString(uid) || aws.ToString(lu.Uploads[0].Key) != key {
			t.Fatalf("ListMultipartUploads: %+v", lu.Uploads)
		}
	})

	t.Run("wrong_order_and_wrong_etag", func(t *testing.T) {
		_, err := c.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: &b.Name, Key: &key, UploadId: uid,
			MultipartUpload: &types.CompletedMultipartUpload{Parts: []types.CompletedPart{done[1], done[0], done[2]}}})
		requireAPIError(t, err, "InvalidPartOrder", 400)
		bad := done[0]
		bad.ETag = aws.String(`"00000000000000000000000000000000"`)
		_, err = c.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: &b.Name, Key: &key, UploadId: uid,
			MultipartUpload: &types.CompletedMultipartUpload{Parts: []types.CompletedPart{bad, done[1], done[2]}}})
		requireAPIError(t, err, "InvalidPart", 400)
	})

	t.Run("complete", func(t *testing.T) {
		out, err := c.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: &b.Name, Key: &key, UploadId: uid,
			MultipartUpload: &types.CompletedMultipartUpload{Parts: done}})
		must(t, err, "CompleteMultipartUpload")
		if aws.ToString(out.ETag) != multipartETag(parts...) {
			t.Fatalf("ETag %q", aws.ToString(out.ETag))
		}
		var cat []byte
		for _, p := range parts {
			cat = append(cat, []byte(sha256Raw(p))...)
		}
		wantCk := checksumB64(types.ChecksumAlgorithmSha256, cat) + "-3"
		if aws.ToString(out.ChecksumSHA256) != wantCk {
			t.Errorf("composite SHA256 %q, want %q", aws.ToString(out.ChecksumSHA256), wantCk)
		}
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key})
		must(t, err, "GetObject")
		sameBytes(t, "object", readAll(t, g.Body), bytes.Join(parts, nil))
		if aws.ToString(g.ContentType) != "text/x-mp" || g.Metadata["k"] != "v" {
			t.Errorf("headers from CreateMultipartUpload lost: %q %v", aws.ToString(g.ContentType), g.Metadata)
		}
	})

	t.Run("get_by_part_number", func(t *testing.T) {
		for i, p := range parts {
			n := int32(i + 1)
			g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, PartNumber: &n})
			must(t, err, fmt.Sprintf("GetObject part %d", n))
			sameBytes(t, fmt.Sprintf("part %d", n), readAll(t, g.Body), p)
			if aws.ToInt32(g.PartsCount) != 3 {
				t.Errorf("PartsCount %d", aws.ToInt32(g.PartsCount))
			}
		}
		n := int32(4)
		_, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: &key, PartNumber: &n})
		requireAPIError(t, err, "InvalidPartNumber", 416)
	})

	t.Run("object_attributes", func(t *testing.T) {
		out, err := c.GetObjectAttributes(ctx, &s3.GetObjectAttributesInput{Bucket: &b.Name, Key: &key,
			ObjectAttributes: []types.ObjectAttributes{types.ObjectAttributesEtag, types.ObjectAttributesObjectSize, types.ObjectAttributesObjectParts, types.ObjectAttributesStorageClass, types.ObjectAttributesChecksum}})
		must(t, err, "GetObjectAttributes")
		if aws.ToInt64(out.ObjectSize) != int64(5*MiB+5*MiB+3+1234) || out.ObjectParts == nil || aws.ToInt32(out.ObjectParts.TotalPartsCount) != 3 || len(out.ObjectParts.Parts) != 3 {
			t.Fatalf("attributes %+v parts %+v", out, out.ObjectParts)
		}
	})

	t.Run("abort_and_nosuchupload", func(t *testing.T) {
		c2, err := c.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/aborted")})
		must(t, err, "CreateMultipartUpload")
		n := int32(1)
		_, err = c.UploadPart(ctx, &s3.UploadPartInput{Bucket: &b.Name, Key: aws.String("low/aborted"), UploadId: c2.UploadId, PartNumber: &n, Body: strings.NewReader("x")})
		must(t, err, "UploadPart")
		_, err = c.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/aborted"), UploadId: c2.UploadId})
		must(t, err, "AbortMultipartUpload")
		_, err = c.UploadPart(ctx, &s3.UploadPartInput{Bucket: &b.Name, Key: aws.String("low/aborted"), UploadId: c2.UploadId, PartNumber: &n, Body: strings.NewReader("x")})
		requireAPIError(t, err, "NoSuchUpload", 404)
		_, err = c.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/aborted"), UploadId: c2.UploadId})
		var nsu *types.NoSuchUpload
		if !errors.As(err, &nsu) {
			t.Fatalf("a second AbortMultipartUpload: want *types.NoSuchUpload, got %T: %v", err, err)
		}
	})

	t.Run("entity_too_small", func(t *testing.T) {
		c2, err := c.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/small")})
		must(t, err, "CreateMultipartUpload")
		var cp []types.CompletedPart
		for i := 1; i <= 2; i++ {
			n := int32(i)
			out, err := c.UploadPart(ctx, &s3.UploadPartInput{Bucket: &b.Name, Key: aws.String("low/small"), UploadId: c2.UploadId, PartNumber: &n, Body: strings.NewReader("tiny")})
			must(t, err, "UploadPart")
			cp = append(cp, types.CompletedPart{ETag: out.ETag, PartNumber: &n})
		}
		_, err = c.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/small"), UploadId: c2.UploadId, MultipartUpload: &types.CompletedMultipartUpload{Parts: cp}})
		requireAPIError(t, err, "EntityTooSmall", 400)
	})

	t.Run("upload_part_copy", func(t *testing.T) {
		src := randBytes(11 * MiB)
		_, err := c.PutObject(ctx, &s3.PutObjectInput{Bucket: &b.Name, Key: aws.String("low/src"), Body: bytes.NewReader(src)})
		must(t, err, "PutObject")
		c2, err := c.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/copied")})
		must(t, err, "CreateMultipartUpload")
		var cp []types.CompletedPart
		for i, r := range [][2]int{{0, 5*MiB - 1}, {5 * MiB, 10*MiB - 1}, {10 * MiB, 11*MiB - 1}} {
			n := int32(i + 1)
			out, err := c.UploadPartCopy(ctx, &s3.UploadPartCopyInput{Bucket: &b.Name, Key: aws.String("low/copied"), UploadId: c2.UploadId, PartNumber: &n,
				CopySource: aws.String(copySource(b.Name, "low/src")), CopySourceRange: aws.String(fmt.Sprintf("bytes=%d-%d", r[0], r[1]))})
			must(t, err, "UploadPartCopy")
			cp = append(cp, types.CompletedPart{ETag: out.CopyPartResult.ETag, PartNumber: &n})
		}
		_, err = c.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{Bucket: &b.Name, Key: aws.String("low/copied"), UploadId: c2.UploadId, MultipartUpload: &types.CompletedMultipartUpload{Parts: cp}})
		must(t, err, "CompleteMultipartUpload")
		g, err := c.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.Name, Key: aws.String("low/copied")})
		must(t, err, "GetObject")
		sameBytes(t, "assembled copy", readAll(t, g.Body), src)
	})
}
