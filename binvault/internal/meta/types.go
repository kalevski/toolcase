package meta

import (
	"encoding/json"
	"errors"
	"time"
)

// Errors returned by the metadata layer.
var (
	ErrNotFound = errors.New("meta: not found")
	ErrExists   = errors.New("meta: already exists")
	ErrConflict = errors.New("meta: revision conflict")
)

// Versioning and encryption settings (spec §3.10, §3.11).
const (
	VersioningOff     = "off"
	VersioningEnabled = "enabled"
	EncryptionNone    = "none"
	EncryptionSSES3   = "sse-s3"
	AnonOff           = "off"
	AnonObjects       = "objects"
)

// Limits are the rate limits of a bucket or token (spec §4.9). Zero = unlimited.
type Limits struct {
	RequestsPerSecond float64 `json:"requests_per_second,omitempty"`
	Burst             int     `json:"burst,omitempty"`
	BytesInPerSecond  int64   `json:"bytes_in_per_second,omitempty"`
	BytesOutPerSecond int64   `json:"bytes_out_per_second,omitempty"`
}

// CORSRule is one bucket CORS rule (spec §5.10, §6.3).
type CORSRule struct {
	AllowedOrigins []string `json:"allowed_origins"`
	AllowedMethods []string `json:"allowed_methods"`
	AllowedHeaders []string `json:"allowed_headers,omitempty"`
	ExposeHeaders  []string `json:"expose_headers,omitempty"`
	MaxAgeSeconds  int      `json:"max_age_seconds,omitempty"`
}

// LifecycleFilter selects objects for a lifecycle rule (spec §3.12).
type LifecycleFilter struct {
	Prefix  string            `json:"prefix,omitempty"`
	Tags    map[string]string `json:"tags,omitempty"`
	MinSize int64             `json:"min_size,omitempty"`
	MaxSize int64             `json:"max_size,omitempty"`
}

// LifecycleRule is one lifecycle rule (spec §3.12).
type LifecycleRule struct {
	ID                  string          `json:"id"`
	Enabled             *bool           `json:"enabled,omitempty"` // nil = true
	Filter              LifecycleFilter `json:"filter,omitempty"`
	ExpireDays          int             `json:"expire_days,omitempty"`
	ExpireDeleteMarkers bool            `json:"expire_delete_markers,omitempty"`
	NoncurrentDays      int             `json:"noncurrent_days,omitempty"`
	NoncurrentKeep      int             `json:"noncurrent_keep,omitempty"`
	AbortMultipartDays  int             `json:"abort_multipart_days,omitempty"`
}

// IsEnabled reports whether the rule is on (the default).
func (r LifecycleRule) IsEnabled() bool { return r.Enabled == nil || *r.Enabled }

// Counters are the per-bucket counters kept in the commit transaction (spec §3.2).
type Counters struct {
	Objects       int64 // visible keys
	Versions      int64 // all version rows, delete markers included
	DeleteMarkers int64
	Bytes         int64 // logical bytes of data versions
	UploadBytes   int64 // bytes of open multipart parts
}

// Bucket is a bucket's settings and counters.
type Bucket struct {
	Name       string
	Generation string
	CreatedAt  time.Time
	Revision   int64

	QuotaBytes          *int64
	MaxObjects          *int64
	MaxObjectBytes      *int64
	AllowedContentTypes []string
	Versioning          string
	Encryption          string
	Lifecycle           []LifecycleRule
	Limits              Limits
	AnonymousRead       string
	AnonymousPrefixes   []string
	CORS                []CORSRule
	DataKey             []byte // sealed bucket data key (nil until first needed)

	AttachmentsRevision int64
	// Epoch is the epoch of this node's copy of the bucket (spec §8.8): the number
	// of moves that brought it here, 0 for a bucket created on this node. A cluster
	// node serves the bucket only while the catalog's epoch is the same.
	Epoch int64
	Counters
}

// Grant is one token grant (spec §4.3): actions on key patterns.
type Grant struct {
	Actions []string `json:"actions"`
	Keys    []string `json:"keys,omitempty"` // omitted = every key
}

// Token is a bucket token (spec §4.3). Secret is sealed.
type Token struct {
	AccessKeyID string
	Bucket      string
	Name        string
	Secret      []byte
	Grants      []Grant
	Limits      Limits
	ExpiresAt   *time.Time
	CreatedAt   time.Time
	LastUsedAt  *time.Time
	Revision    int64
}

// Object is one stored version of a key (spec §3.3).
type Object struct {
	Seq          int64
	Bucket       string
	Key          string
	Version      string
	IsLatest     bool
	DeleteMarker bool
	NullVersion  bool
	BlobID       string
	Size         int64
	ETag         string // hex, no quotes; multipart: "<hex>-N"
	SHA256       string // hex
	ChecksumAlgo string
	Checksum     string // base64 (composite: "<b64>-N")
	ChecksumType string // "FULL_OBJECT" | "COMPOSITE" | ""

	ContentType        string
	ContentEncoding    string
	ContentLanguage    string
	ContentDisposition string
	CacheControl       string
	Expires            string

	Metadata map[string]string
	Tags     map[string]string
	Parts    []int64 // part sizes, multipart objects only

	CreatedAt       time.Time
	NoncurrentSince *time.Time
	SSE             bool
}

// Visible reports whether a plain GET would return this version.
func (o *Object) Visible() bool { return o != nil && o.IsLatest && !o.DeleteMarker }

// S3VersionID is the VersionId S3 clients see (spec §3.10).
func (o *Object) S3VersionID() string {
	if o.NullVersion {
		return "null"
	}
	return o.Version
}

// Blob is a stored body (spec §3.4).
type Blob struct {
	BlobID    string
	Bucket    string
	Size      int64 // bytes on disk (ciphertext size when SSE)
	PlainSize int64
	SSE       bool
	Refs      int64
	ZeroSince *time.Time
	CreatedAt time.Time
}

// Upload is a multipart upload (spec §5.6).
type Upload struct {
	UploadID       string
	Bucket         string
	Key            string
	InitiatedAt    time.Time
	UpdatedAt      time.Time
	State          string // "open" | "completed"
	CompletedAt    *time.Time
	Encrypted      bool
	Headers        map[string]string
	Metadata       map[string]string
	Tags           map[string]string
	ChecksumAlgo   string
	ChecksumType   string
	StorageClass   string
	Actor          json.RawMessage
	CompleteHash   string
	CompleteResult json.RawMessage
}

// Part is one uploaded part.
type Part struct {
	UploadID     string
	Number       int
	PartID       string
	Size         int64 // plaintext
	StoredSize   int64
	ETag         string
	ChecksumAlgo string
	Checksum     string
	CreatedAt    time.Time
}

// ms converts a time to unix milliseconds for storage.
func ms(t time.Time) int64 { return t.UnixMilli() }

// fromMS converts stored milliseconds back.
func fromMS(v int64) time.Time { return time.UnixMilli(v).UTC() }

func msPtr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UnixMilli()
}

func fromMSPtr(v *int64) *time.Time {
	if v == nil {
		return nil
	}
	t := fromMS(*v)
	return &t
}
