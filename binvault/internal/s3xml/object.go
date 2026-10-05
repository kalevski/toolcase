package s3xml

import (
	"encoding/xml"
	"errors"
	"fmt"
	"sort"
	"unicode/utf8"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// Checksums are the additional checksums of an object or part (spec §5.8),
// base64 as on the wire. Embedded where S3 writes them inline; empty values
// are omitted.
type Checksums struct {
	CRC32     string `xml:"ChecksumCRC32,omitempty"`
	CRC32C    string `xml:"ChecksumCRC32C,omitempty"`
	CRC64NVME string `xml:"ChecksumCRC64NVME,omitempty"`
	SHA1      string `xml:"ChecksumSHA1,omitempty"`
	SHA256    string `xml:"ChecksumSHA256,omitempty"`
}

// CommonPrefix is one <CommonPrefixes> element of a listing.
type CommonPrefix struct {
	Prefix string `xml:"Prefix"`
}

// Object is one <Contents> entry of a listing (spec §5.4.6). StorageClass
// should be StorageClassStandard; Owner is set for ListObjects (V1) and for
// V2 with fetch-owner=true.
type Object struct {
	Key               string   `xml:"Key"`
	LastModified      Time     `xml:"LastModified"`
	ETag              string   `xml:"ETag"` // quoted, see ETagQuoted
	ChecksumAlgorithm []string `xml:"ChecksumAlgorithm,omitempty"`
	ChecksumType      string   `xml:"ChecksumType,omitempty"`
	Size              int64    `xml:"Size"`
	Owner             *Owner   `xml:"Owner,omitempty"`
	StorageClass      string   `xml:"StorageClass,omitempty"`
}

// ListBucketResult answers ListObjects (V1, GET /{bucket}). Prefix and Marker
// are always written (empty when absent); NextMarker only when set, which S3
// does for truncated listings with a delimiter.
type ListBucketResult struct {
	XMLName        xml.Name       `xml:"ListBucketResult"`
	Name           string         `xml:"Name"`
	Prefix         string         `xml:"Prefix"`
	Marker         string         `xml:"Marker"`
	NextMarker     string         `xml:"NextMarker,omitempty"`
	MaxKeys        int            `xml:"MaxKeys"`
	Delimiter      string         `xml:"Delimiter,omitempty"`
	EncodingType   string         `xml:"EncodingType,omitempty"`
	IsTruncated    bool           `xml:"IsTruncated"`
	Contents       []Object       `xml:"Contents"`
	CommonPrefixes []CommonPrefix `xml:"CommonPrefixes"`
}

// EncodeURL applies encoding-type=url in place, as S3 does for V1: it sets
// EncodingType and percent-encodes Prefix, Delimiter, Marker, NextMarker,
// every Key and every common prefix with EncodeKey. Call it once, on raw
// values.
func (r *ListBucketResult) EncodeURL() {
	r.EncodingType = EncodingTypeURL
	encodeAll(&r.Prefix, &r.Delimiter, &r.Marker, &r.NextMarker)
	encodeObjects(r.Contents)
	encodePrefixes(r.CommonPrefixes)
}

// ListBucketResultV2 answers ListObjectsV2 (GET /{bucket}?list-type=2).
// KeyCount (keys plus common prefixes returned) and Prefix are always
// written; StartAfter, ContinuationToken and NextContinuationToken only when
// set.
type ListBucketResultV2 struct {
	XMLName               xml.Name       `xml:"ListBucketResult"`
	Name                  string         `xml:"Name"`
	Prefix                string         `xml:"Prefix"`
	StartAfter            string         `xml:"StartAfter,omitempty"`
	ContinuationToken     string         `xml:"ContinuationToken,omitempty"`
	NextContinuationToken string         `xml:"NextContinuationToken,omitempty"`
	KeyCount              int            `xml:"KeyCount"`
	MaxKeys               int            `xml:"MaxKeys"`
	Delimiter             string         `xml:"Delimiter,omitempty"`
	EncodingType          string         `xml:"EncodingType,omitempty"`
	IsTruncated           bool           `xml:"IsTruncated"`
	Contents              []Object       `xml:"Contents"`
	CommonPrefixes        []CommonPrefix `xml:"CommonPrefixes"`
}

// EncodeURL applies encoding-type=url in place, as S3 does for V2: it sets
// EncodingType and percent-encodes Prefix, Delimiter, StartAfter, every Key
// and every common prefix (continuation tokens are opaque and left alone).
// Call it once, on raw values.
func (r *ListBucketResultV2) EncodeURL() {
	r.EncodingType = EncodingTypeURL
	encodeAll(&r.Prefix, &r.Delimiter, &r.StartAfter)
	encodeObjects(r.Contents)
	encodePrefixes(r.CommonPrefixes)
}

// VersionEntry is one entry of ListVersionsResult: a <Version>, or a
// <DeleteMarker> when DeleteMarker is set, in which case only Key, VersionID,
// IsLatest, LastModified and Owner are written. VersionID is "null" for the
// null version (spec §3.10).
type VersionEntry struct {
	DeleteMarker      bool
	Key               string
	VersionID         string
	IsLatest          bool
	LastModified      Time
	ETag              string
	ChecksumAlgorithm []string
	ChecksumType      string
	Size              int64
	Owner             *Owner
	StorageClass      string
}

type versionXML struct {
	Key               string   `xml:"Key"`
	VersionID         string   `xml:"VersionId"`
	IsLatest          bool     `xml:"IsLatest"`
	LastModified      Time     `xml:"LastModified"`
	ETag              string   `xml:"ETag"`
	ChecksumAlgorithm []string `xml:"ChecksumAlgorithm,omitempty"`
	ChecksumType      string   `xml:"ChecksumType,omitempty"`
	Size              int64    `xml:"Size"`
	Owner             *Owner   `xml:"Owner,omitempty"`
	StorageClass      string   `xml:"StorageClass,omitempty"`
}

type deleteMarkerXML struct {
	Key          string `xml:"Key"`
	VersionID    string `xml:"VersionId"`
	IsLatest     bool   `xml:"IsLatest"`
	LastModified Time   `xml:"LastModified"`
	Owner        *Owner `xml:"Owner,omitempty"`
}

// MarshalXML writes a <Version> or a <DeleteMarker>.
func (v VersionEntry) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	if v.DeleteMarker {
		return e.EncodeElement(deleteMarkerXML{v.Key, v.VersionID, v.IsLatest, v.LastModified, v.Owner},
			xml.StartElement{Name: xml.Name{Local: "DeleteMarker"}})
	}
	return e.EncodeElement(versionXML{v.Key, v.VersionID, v.IsLatest, v.LastModified, v.ETag,
		v.ChecksumAlgorithm, v.ChecksumType, v.Size, v.Owner, v.StorageClass},
		xml.StartElement{Name: xml.Name{Local: "Version"}})
}

// UnmarshalXML reads a <Version> or a <DeleteMarker>.
func (v *VersionEntry) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	switch start.Name.Local {
	case "Version", "DeleteMarker":
	default:
		return fmt.Errorf("s3xml: unexpected element <%s> in ListVersionsResult", start.Name.Local)
	}
	var x versionXML
	if err := d.DecodeElement(&x, &start); err != nil {
		return err
	}
	*v = VersionEntry{
		DeleteMarker: start.Name.Local == "DeleteMarker",
		Key:          x.Key, VersionID: x.VersionID, IsLatest: x.IsLatest, LastModified: x.LastModified,
		ETag: x.ETag, ChecksumAlgorithm: x.ChecksumAlgorithm, ChecksumType: x.ChecksumType,
		Size: x.Size, Owner: x.Owner, StorageClass: x.StorageClass,
	}
	return nil
}

// ListVersionsResult answers ListObjectVersions (GET /{bucket}?versions, spec
// §5.4.8). Entries is one ordered list, so versions and delete markers come
// out interleaved exactly as given: keys ascending, each key's versions
// newest first. KeyMarker and VersionIdMarker are always written; the Next*
// markers only when set (truncated listings).
type ListVersionsResult struct {
	XMLName             xml.Name       `xml:"ListVersionsResult"`
	Name                string         `xml:"Name"`
	Prefix              string         `xml:"Prefix"`
	KeyMarker           string         `xml:"KeyMarker"`
	VersionIDMarker     string         `xml:"VersionIdMarker"`
	NextKeyMarker       string         `xml:"NextKeyMarker,omitempty"`
	NextVersionIDMarker string         `xml:"NextVersionIdMarker,omitempty"`
	MaxKeys             int            `xml:"MaxKeys"`
	Delimiter           string         `xml:"Delimiter,omitempty"`
	EncodingType        string         `xml:"EncodingType,omitempty"`
	IsTruncated         bool           `xml:"IsTruncated"`
	Entries             []VersionEntry `xml:",any"`
	CommonPrefixes      []CommonPrefix `xml:"CommonPrefixes"`
}

// EncodeURL applies encoding-type=url in place, as S3 does for
// ListObjectVersions: it sets EncodingType and percent-encodes Prefix,
// Delimiter, KeyMarker, NextKeyMarker, every Key and every common prefix
// (version ids are left alone). Call it once, on raw values.
func (r *ListVersionsResult) EncodeURL() {
	r.EncodingType = EncodingTypeURL
	encodeAll(&r.Prefix, &r.Delimiter, &r.KeyMarker, &r.NextKeyMarker)
	for i := range r.Entries {
		r.Entries[i].Key = EncodeKey(r.Entries[i].Key, true)
	}
	encodePrefixes(r.CommonPrefixes)
}

func encodeAll(fields ...*string) {
	for _, f := range fields {
		*f = EncodeKey(*f, true)
	}
}

func encodeObjects(objs []Object) {
	for i := range objs {
		objs[i].Key = EncodeKey(objs[i].Key, true)
	}
}

func encodePrefixes(ps []CommonPrefix) {
	for i := range ps {
		ps[i].Prefix = EncodeKey(ps[i].Prefix, true)
	}
}

// CopyObjectResult is the CopyObject response body (spec §5.4.5).
type CopyObjectResult struct {
	XMLName      xml.Name `xml:"CopyObjectResult"`
	LastModified Time     `xml:"LastModified"`
	ETag         string   `xml:"ETag"`
	ChecksumType string   `xml:"ChecksumType,omitempty"`
	Checksums
}

// CopyPartResult is the UploadPartCopy response body (spec §5.6).
type CopyPartResult struct {
	XMLName      xml.Name `xml:"CopyPartResult"`
	LastModified Time     `xml:"LastModified"`
	ETag         string   `xml:"ETag"`
	Checksums
}

// Delete is the DeleteObjects request body (POST /{bucket}?delete, spec
// §5.4.4). An Object without <VersionId> has VersionID "".
type Delete struct {
	XMLName xml.Name           `xml:"Delete"`
	Objects []ObjectIdentifier `xml:"Object"`
	Quiet   bool               `xml:"Quiet,omitempty"`
}

// ObjectIdentifier is one <Object> of a Delete request. ETag,
// LastModifiedTime and Size are the conditional-delete fields newer SDKs can
// send; nil or empty when absent.
type ObjectIdentifier struct {
	Key              string `xml:"Key"`
	VersionID        string `xml:"VersionId,omitempty"`
	ETag             string `xml:"ETag,omitempty"`
	LastModifiedTime *Time  `xml:"LastModifiedTime,omitempty"`
	Size             *int64 `xml:"Size,omitempty"`
}

// UnmarshalXML decodes one <Object> of a Delete request. <Key> must be present
// (an <Object> without one is MalformedXML in S3, not a per-entry error); an
// explicitly empty <Key/> is left to the per-entry key validation.
func (o *ObjectIdentifier) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	var x struct {
		Key              *string `xml:"Key"`
		VersionID        string  `xml:"VersionId"`
		ETag             string  `xml:"ETag"`
		LastModifiedTime *Time   `xml:"LastModifiedTime"`
		Size             *int64  `xml:"Size"`
	}
	if err := d.DecodeElement(&x, &start); err != nil {
		return err
	}
	if x.Key == nil {
		return errors.New("s3xml: an <Object> needs a <Key>")
	}
	*o = ObjectIdentifier{Key: *x.Key, VersionID: x.VersionID, ETag: x.ETag, LastModifiedTime: x.LastModifiedTime, Size: x.Size}
	return nil
}

// MaxDeleteObjects is the most keys one DeleteObjects request may name (§3.8).
const MaxDeleteObjects = 1000

// Validate checks the shape S3 checks before looking at any key: 1 to
// MaxDeleteObjects entries (MalformedXML otherwise, as in S3). Each entry is
// then judged on its own by the caller.
func (d Delete) Validate() error {
	if len(d.Objects) == 0 || len(d.Objects) > MaxDeleteObjects {
		return apierr.New("MalformedXML", msgMalformedXML)
	}
	return nil
}

// DeleteResult is the DeleteObjects response body. With Quiet, only Errors
// are reported.
type DeleteResult struct {
	XMLName xml.Name        `xml:"DeleteResult"`
	Deleted []DeletedObject `xml:"Deleted"`
	Errors  []DeleteError   `xml:"Error"`
}

// DeletedObject is one <Deleted> entry. DeleteMarker and
// DeleteMarkerVersionID report a delete marker that the delete added, or the
// one it permanently removed (spec §3.10).
type DeletedObject struct {
	Key                   string `xml:"Key"`
	VersionID             string `xml:"VersionId,omitempty"`
	DeleteMarker          bool   `xml:"DeleteMarker,omitempty"`
	DeleteMarkerVersionID string `xml:"DeleteMarkerVersionId,omitempty"`
}

// DeleteError is one <Error> entry of a DeleteResult.
type DeleteError struct {
	Key       string `xml:"Key"`
	VersionID string `xml:"VersionId,omitempty"`
	Code      string `xml:"Code"`
	Message   string `xml:"Message"`
}

// Tag is one <Tag>.
type Tag struct {
	Key   string `xml:"Key"`
	Value string `xml:"Value"`
}

// UnmarshalXML decodes a <Tag>, which needs both <Key> and <Value> (S3 answers
// MalformedXML for a tag without a value; an empty <Value/> is a valid empty
// value).
func (t *Tag) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	var x struct {
		Key   *string `xml:"Key"`
		Value *string `xml:"Value"`
	}
	if err := d.DecodeElement(&x, &start); err != nil {
		return err
	}
	if x.Key == nil || x.Value == nil {
		return errors.New("s3xml: a <Tag> needs both <Key> and <Value>")
	}
	t.Key, t.Value = *x.Key, *x.Value
	return nil
}

// Tagging is the GetObjectTagging answer and the PutObjectTagging (and POST
// Object "tagging" field) request body (spec §5.7). <TagSet> is always
// written, empty when there are no tags.
type Tagging struct {
	XMLName xml.Name `xml:"Tagging"`
	TagSet  []Tag    `xml:"TagSet>Tag"`
}

// Tag limits (spec §3.8, §5.7), counted in characters.
const (
	MaxTags        = 10
	MaxTagKeyLen   = 128
	MaxTagValueLen = 256
)

// NewTagging builds a Tagging from a tag map, sorted by key so documents are
// deterministic.
func NewTagging(tags map[string]string) Tagging {
	t := Tagging{TagSet: make([]Tag, 0, len(tags))}
	for k, v := range tags {
		t.TagSet = append(t.TagSet, Tag{Key: k, Value: v})
	}
	sort.Slice(t.TagSet, func(i, j int) bool { return t.TagSet[i].Key < t.TagSet[j].Key })
	return t
}

// Map returns the tags as a map.
func (t Tagging) Map() map[string]string {
	m := make(map[string]string, len(t.TagSet))
	for _, tag := range t.TagSet {
		m[tag.Key] = tag.Value
	}
	return m
}

// Validate enforces the tag limits of spec §5.7 — at most MaxTags tags,
// non-empty keys of at most MaxTagKeyLen characters, values of at most
// MaxTagValueLen characters, no repeated key — as InvalidTag errors.
func (t Tagging) Validate() error {
	if len(t.TagSet) > MaxTags {
		return apierr.Newf("InvalidTag", "Object tags cannot be greater than %d", MaxTags)
	}
	seen := make(map[string]bool, len(t.TagSet))
	for _, tag := range t.TagSet {
		if n := utf8.RuneCountInString(tag.Key); n == 0 || n > MaxTagKeyLen {
			return apierr.New("InvalidTag", "The TagKey you have provided is invalid")
		}
		if utf8.RuneCountInString(tag.Value) > MaxTagValueLen {
			return apierr.New("InvalidTag", "The TagValue you have provided is invalid")
		}
		if seen[tag.Key] {
			return apierr.New("InvalidTag", "Cannot provide multiple Tags with the same key")
		}
		seen[tag.Key] = true
	}
	return nil
}

// PostResponse is the body of a POST Object answered with
// success_action_status=201 (spec §5.4.9).
type PostResponse struct {
	XMLName  xml.Name `xml:"PostResponse"`
	Location string   `xml:"Location"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	ETag     string   `xml:"ETag"`
}

// GetObjectAttributesResponse answers GetObjectAttributes (spec §5.4.7). Only
// the attributes named in x-amz-object-attributes are set; unset ones are
// omitted. S3 writes this ETag without quotes (unlike headers and listings).
type GetObjectAttributesResponse struct {
	XMLName      xml.Name        `xml:"GetObjectAttributesResponse"`
	ETag         string          `xml:"ETag,omitempty"`
	Checksum     *ObjectChecksum `xml:"Checksum,omitempty"`
	ObjectParts  *ObjectParts    `xml:"ObjectParts,omitempty"`
	StorageClass string          `xml:"StorageClass,omitempty"`
	ObjectSize   *int64          `xml:"ObjectSize,omitempty"`
}

// ObjectChecksum is the <Checksum> element of GetObjectAttributes.
type ObjectChecksum struct {
	Checksums
	ChecksumType string `xml:"ChecksumType,omitempty"`
}

// ObjectParts is the <ObjectParts> element of GetObjectAttributes, for
// objects created by multipart upload. TotalPartsCount is written as
// <PartsCount>, the wire name of the SDKs' TotalPartsCount.
type ObjectParts struct {
	TotalPartsCount      int          `xml:"PartsCount"`
	PartNumberMarker     int          `xml:"PartNumberMarker"`
	NextPartNumberMarker int          `xml:"NextPartNumberMarker"`
	MaxParts             int          `xml:"MaxParts"`
	IsTruncated          bool         `xml:"IsTruncated"`
	Parts                []ObjectPart `xml:"Part"`
}

// ObjectPart is one <Part> of ObjectParts.
type ObjectPart struct {
	PartNumber int   `xml:"PartNumber"`
	Size       int64 `xml:"Size"`
	Checksums
}
