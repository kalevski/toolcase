package s3xml

import (
	"encoding/xml"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// MaxPartNumber is the highest multipart part number (spec §3.8).
const MaxPartNumber = 10000

// InitiateMultipartUploadResult is the CreateMultipartUpload response body
// (spec §5.6).
type InitiateMultipartUploadResult struct {
	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	UploadID string   `xml:"UploadId"`
}

// CompleteMultipartUpload is the CompleteMultipartUpload request body.
type CompleteMultipartUpload struct {
	XMLName xml.Name        `xml:"CompleteMultipartUpload"`
	Parts   []CompletedPart `xml:"Part"`
}

// CompletedPart is one <Part> of a CompleteMultipartUpload request. ETag is as
// sent, usually quoted; compare it through ETagUnquoted.
type CompletedPart struct {
	PartNumber int    `xml:"PartNumber"`
	ETag       string `xml:"ETag"`
	Checksums
}

// Validate checks what can be judged from the document alone: at least one
// part (MalformedXML), part numbers within 1..MaxPartNumber (InvalidArgument)
// and strictly ascending (InvalidPartOrder). Whether each part exists with
// that ETag, and the size rules, are for the caller (InvalidPart,
// EntityTooSmall).
func (c CompleteMultipartUpload) Validate() error {
	if len(c.Parts) == 0 {
		return apierr.New("MalformedXML", msgMalformedXML)
	}
	prev := 0
	for _, p := range c.Parts {
		if p.PartNumber < 1 || p.PartNumber > MaxPartNumber {
			return apierr.Newf("InvalidArgument", "Part number must be an integer between 1 and %d, inclusive", MaxPartNumber).
				WithExtra("ArgumentName", "PartNumber")
		}
		if p.PartNumber <= prev {
			return apierr.New("InvalidPartOrder", "The list of parts was not in ascending order. The parts list must be specified in order by part number.")
		}
		prev = p.PartNumber
	}
	return nil
}

// CompleteMultipartUploadResult is the CompleteMultipartUpload response body.
// ETag is the quoted multipart tag "<md5>-<N>" (spec §5.6). Location is the
// object URL, with the key percent-encoded by the caller.
type CompleteMultipartUploadResult struct {
	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
	Location string   `xml:"Location"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	ETag     string   `xml:"ETag"`
	Checksums
	ChecksumType string `xml:"ChecksumType,omitempty"`
}

// Part is one <Part> of ListPartsResult.
type Part struct {
	PartNumber   int    `xml:"PartNumber"`
	LastModified Time   `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int64  `xml:"Size"`
	Checksums
}

// ListPartsResult answers ListParts (spec §5.6). PartNumberMarker and
// NextPartNumberMarker are always written (0 when unset), as S3 does.
type ListPartsResult struct {
	XMLName              xml.Name `xml:"ListPartsResult"`
	Bucket               string   `xml:"Bucket"`
	Key                  string   `xml:"Key"`
	UploadID             string   `xml:"UploadId"`
	Initiator            Owner    `xml:"Initiator"`
	Owner                Owner    `xml:"Owner"`
	StorageClass         string   `xml:"StorageClass,omitempty"`
	PartNumberMarker     int      `xml:"PartNumberMarker"`
	NextPartNumberMarker int      `xml:"NextPartNumberMarker"`
	MaxParts             int      `xml:"MaxParts"`
	IsTruncated          bool     `xml:"IsTruncated"`
	Parts                []Part   `xml:"Part"`
	ChecksumAlgorithm    string   `xml:"ChecksumAlgorithm,omitempty"`
	ChecksumType         string   `xml:"ChecksumType,omitempty"`
}

// Upload is one <Upload> of ListMultipartUploadsResult.
type Upload struct {
	Key               string `xml:"Key"`
	UploadID          string `xml:"UploadId"`
	Initiator         Owner  `xml:"Initiator"`
	Owner             Owner  `xml:"Owner"`
	StorageClass      string `xml:"StorageClass,omitempty"`
	Initiated         Time   `xml:"Initiated"`
	ChecksumAlgorithm string `xml:"ChecksumAlgorithm,omitempty"`
	ChecksumType      string `xml:"ChecksumType,omitempty"`
}

// ListMultipartUploadsResult answers ListMultipartUploads (GET
// /{bucket}?uploads, spec §5.6). The four marker elements and Prefix are
// always written, empty when unset, as S3 does.
type ListMultipartUploadsResult struct {
	XMLName            xml.Name       `xml:"ListMultipartUploadsResult"`
	Bucket             string         `xml:"Bucket"`
	KeyMarker          string         `xml:"KeyMarker"`
	UploadIDMarker     string         `xml:"UploadIdMarker"`
	NextKeyMarker      string         `xml:"NextKeyMarker"`
	NextUploadIDMarker string         `xml:"NextUploadIdMarker"`
	Delimiter          string         `xml:"Delimiter,omitempty"`
	Prefix             string         `xml:"Prefix"`
	EncodingType       string         `xml:"EncodingType,omitempty"`
	MaxUploads         int            `xml:"MaxUploads"`
	IsTruncated        bool           `xml:"IsTruncated"`
	Uploads            []Upload       `xml:"Upload"`
	CommonPrefixes     []CommonPrefix `xml:"CommonPrefixes"`
}

// EncodeURL applies encoding-type=url in place, as S3 does for
// ListMultipartUploads: it sets EncodingType and percent-encodes Prefix,
// Delimiter, KeyMarker, NextKeyMarker, every Key and every common prefix
// (upload ids are left alone). Call it once, on raw values.
func (r *ListMultipartUploadsResult) EncodeURL() {
	r.EncodingType = EncodingTypeURL
	encodeAll(&r.Prefix, &r.Delimiter, &r.KeyMarker, &r.NextKeyMarker)
	for i := range r.Uploads {
		r.Uploads[i].Key = EncodeKey(r.Uploads[i].Key, true)
	}
	encodePrefixes(r.CommonPrefixes)
}
