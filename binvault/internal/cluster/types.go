package cluster

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// ProtocolVersion is the peer-protocol version this binary speaks (spec §8.3,
// §9.6). An op created under a newer version is held until the node is
// upgraded.
const ProtocolVersion = 1

// Register kinds. A register's key is Kind + "/" + name: bucket/<name>,
// pipeline/<name> and key/<access key id> (spec §8.5).
const (
	KindBucket   = "bucket"
	KindPipeline = "pipeline"
	KindKey      = "key"
)

// Header names of the peer link (spec §8.3, §8.4).
const (
	// HeaderPeerKey carries the cluster key on every peer request.
	HeaderPeerKey = "X-Binvault-Peer-Key"
	// HeaderOrigin marks a forwarded S3 request, whatever its path (§8.4); the
	// forwarder alone sets it, with the entry node's id.
	HeaderOrigin = "X-Binvault-Origin"
	// HeaderNode identifies the calling node on peer-API requests, so the
	// answering node can record what the caller has applied.
	HeaderNode = "X-Binvault-Node"
	// HeaderKeyIDs lists the master key ids the caller can open, current first
	// (8 hex characters each, comma-separated). The answering node withholds
	// ops sealed under any other key (§4.7, §8.3).
	HeaderKeyIDs = "X-Binvault-Key-Ids"
	// HeaderHello on a notify asks the receiver to run `hello` against the
	// sender at once (the sender's draining or cordoned state changed).
	HeaderHello = "X-Binvault-Hello"
)

// PeerPrefix is the path prefix of the peer API (spec §8.5).
const PeerPrefix = "/_peer/v1/"

// Errors returned by the package.
var (
	// ErrNotReady: the start-up fence (§8.5) has not ended; the node accepts no
	// catalog write yet.
	ErrNotReady = errors.New("cluster: start-up fence has not ended")
	// ErrNotFound: no such live register.
	ErrNotFound = errors.New("cluster: not found")
	// ErrExists: a live register with that name exists already (create).
	ErrExists = errors.New("cluster: already exists")
	// ErrInvalid wraps every validation failure of a draft or a received op.
	ErrInvalid = errors.New("cluster: invalid")
	// ErrHomesBuckets: the node still homes buckets in the catalog (Retire).
	ErrHomesBuckets = errors.New("cluster: the catalog still lists buckets homed on this node")
	// ErrUnknownNode: no node with that id is known.
	ErrUnknownNode = errors.New("cluster: unknown node")
	// ErrSelf: the operation does not apply to this node itself (Retire).
	ErrSelf = errors.New("cluster: this is the node itself")
	// ErrStopped: the node was stopped.
	ErrStopped = errors.New("cluster: stopped")
)

func invalidf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, args...))
}

// Op is one catalog op as it travels between peers and sits in the log (spec
// §8.5). Identity is (Origin, Seq); an op is immutable once created. Origin is
// an op stream: normally the node id, and a fresh "<node id>.<hex>" after a
// start-up fence that ended with a silent peer (§8.5).
type Op struct {
	Origin string        `json:"origin"`
	Seq    int64         `json:"seq"`
	HLC    hlc.Timestamp `json:"hlc"`
	// V is the peer-protocol version the op was created under.
	V    int    `json:"v"`
	Kind string `json:"kind"`
	// Key is the register's name inside Kind.
	Key string `json:"key"`
	// Prev is the id of the register winner the author replaced, "" for the
	// first write. It only feeds conflict detection; it never decides a winner.
	Prev string `json:"prev,omitempty"`
	// Payload is the canonical JSON of the register value: a BucketEntry, a
	// PipelineEntry or a KeyEntry, or {"deleted":true}.
	Payload json.RawMessage `json:"payload"`
}

// ID is the op's identity, "origin:seq".
func (o *Op) ID() string { return meta.CatalogOpID(o.Origin, o.Seq) }

// Reg is the register this op writes, "kind/name".
func (o *Op) Reg() string { return o.Kind + "/" + o.Key }

// Deleted reports whether the op is a tombstone.
func (o *Op) Deleted() bool { return isTombstone(o.Payload) }

func opFromMeta(m meta.CatalogOp) Op {
	return Op{Origin: m.Origin, Seq: m.Seq, HLC: hlc.Timestamp(m.HLC), V: m.V, Kind: m.Kind, Key: m.Key, Prev: m.Prev, Payload: m.Payload}
}

func (o *Op) toMeta() meta.CatalogOp {
	return meta.CatalogOp{Origin: o.Origin, Seq: o.Seq, HLC: uint64(o.HLC), V: o.V, Kind: o.Kind, Key: o.Key, Prev: o.Prev, Payload: o.Payload}
}

// NodeOf is the node id an op stream belongs to: the origin up to its first
// dot ("n_ab12" and "n_ab12.9f3c…" are both streams of node n_ab12).
func NodeOf(origin string) string {
	node, _, _ := strings.Cut(origin, ".")
	return node
}

// tombstonePayload is the payload of an op that deletes a register.
var tombstonePayload = json.RawMessage(`{"deleted":true}`)

func isTombstone(p []byte) bool { return string(p) == string(tombstonePayload) }

// BucketEntry is the value of a bucket/<name> register (spec §8.5): where a
// bucket lives. The home writes it (and, during a move, the old home's hand-off
// writes it, §8.8).
type BucketEntry struct {
	// Home is the id of the node that stores the bucket (not its name).
	Home string `json:"home"`
	// Epoch counts the bucket's moves; it starts at 0.
	Epoch int64 `json:"epoch"`
	// Generation tells one incarnation of a name from the next, so a deleted and
	// re-created name starts clean. By default it is the id of the op that created
	// the bucket; a creator may bring its own (the bucket's local generation).
	Generation string `json:"generation"`
	// CreatedAt is the creation time, in milliseconds since the Unix epoch.
	CreatedAt int64 `json:"created_at"`
	// Pipelines are the names of the attached pipelines, in attachment order.
	Pipelines []string `json:"pipelines"`
}

// Created is CreatedAt as a time.
func (b BucketEntry) Created() time.Time { return time.UnixMilli(b.CreatedAt).UTC() }

// SealedValue is a secret sealed with seal.Keyring.Seal(Type, ID, plaintext)
// that travels inside a register. It stays sealed: a node that cannot open the
// key that sealed it does not receive the op that carries it (§4.7, §8.3).
type SealedValue struct {
	// Type and ID are the record type and id the value was sealed for (the
	// associated data of the sealing); `rekey` needs them to re-seal it.
	Type string `json:"type"`
	ID   string `json:"id"`
	// Value is the output of Seal.
	Value []byte `json:"value"`
}

// PipelineEntry is the value of a pipeline/<name> register (spec §8.5): the
// definition, its revision and its generation.
type PipelineEntry struct {
	// Definition is the pipeline definition as a JSON object, with its secrets
	// taken out: those travel in Sealed. The node stores it in canonical form
	// (sorted keys, compact), so the bytes a reader gets back are not the bytes
	// the writer passed in, only equivalent JSON.
	Definition json.RawMessage `json:"definition"`
	// Revision counts edits of the definition, from 1.
	Revision int64 `json:"revision"`
	// Generation tells a pipeline from one that was deleted and created again
	// (attachments record it). By default it is the id of the op that created the
	// pipeline; a creator may bring its own.
	Generation string `json:"generation"`
	// Sealed holds the sealed secrets, by field (for example "headers" and
	// "signing_secret").
	Sealed map[string]SealedValue `json:"sealed,omitempty"`
}

// KeyEntry is the value of a key/<access key id> register (spec §8.5): the
// access-key index, no secrets.
type KeyEntry struct {
	Bucket string `json:"bucket"`
}

// Register is one replicated register as the catalog holds it.
type Register struct {
	Key     string // "kind/name"
	Kind    string
	Name    string
	Deleted bool
	// Value is the canonical JSON payload (the tombstone payload for a
	// tombstone).
	Value json.RawMessage
	// Prev is the id of the winner the writing op replaced.
	Prev string
	// HLC, Origin and Seq identify the op that wrote it.
	HLC    hlc.Timestamp
	Origin string
	Seq    int64
}

// OpID is the id of the op that wrote the register.
func (r *Register) OpID() string { return meta.CatalogOpID(r.Origin, r.Seq) }

func registerFromMeta(m *meta.CatalogReg) *Register {
	return &Register{
		Key: m.Key, Kind: m.Kind, Name: m.Name, Deleted: m.Deleted,
		Value: append(json.RawMessage(nil), m.Payload...), Prev: m.Prev,
		HLC: hlc.Timestamp(m.HLC), Origin: m.Origin, Seq: m.Seq,
	}
}

// BucketRecord is a live bucket/<name> register, decoded.
type BucketRecord struct {
	Name string
	BucketEntry
	HLC    hlc.Timestamp
	Origin string
	Seq    int64
}

// OpID is the id of the op that wrote the register.
func (b BucketRecord) OpID() string { return meta.CatalogOpID(b.Origin, b.Seq) }

// PipelineRecord is a live pipeline/<name> register, decoded.
type PipelineRecord struct {
	Name string
	PipelineEntry
	HLC    hlc.Timestamp
	Origin string
	Seq    int64
}

// OpID is the id of the op that wrote the register.
func (p PipelineRecord) OpID() string { return meta.CatalogOpID(p.Origin, p.Seq) }

// KeyRecord is a live key/<access key id> register, decoded.
type KeyRecord struct {
	AccessKeyID string
	KeyEntry
	HLC    hlc.Timestamp
	Origin string
	Seq    int64
}

// OpRef names the op behind a Change.
type OpRef struct {
	Origin string
	Seq    int64
	HLC    hlc.Timestamp
}

// ID is "origin:seq".
func (o OpRef) ID() string { return o.Origin + ":" + strconv.FormatInt(o.Seq, 10) }

// Change describes a register whose value this node now holds a new winner
// for. See Node.OnChange.
type Change struct {
	Kind string
	Name string
	// Key is "kind/name".
	Key     string
	Deleted bool
	// Value is the new payload (nil when Deleted); decode it with the matching
	// entry type.
	Value json.RawMessage
	// Local: written by this node (CreateBucket, ...), not received from a peer.
	Local bool
	// Replayed: delivered by Node.Replay, not by a fresh write.
	Replayed bool
	Op       OpRef
}

// Bucket decodes a bucket change (zero value for a tombstone).
func (c Change) Bucket() (BucketEntry, error) {
	var e BucketEntry
	if c.Deleted || c.Kind != KindBucket {
		return e, nil
	}
	err := json.Unmarshal(c.Value, &e)
	return e, err
}

// Pipeline decodes a pipeline change (zero value for a tombstone).
func (c Change) Pipeline() (PipelineEntry, error) {
	var e PipelineEntry
	if c.Deleted || c.Kind != KindPipeline {
		return e, nil
	}
	err := json.Unmarshal(c.Value, &e)
	return e, err
}

// LocalBucket is what a node holds locally for a bucket, as the application
// reports it for orphan and `missing` detection.
type LocalBucket struct {
	Name       string
	Generation string
	// Epoch is the bucket's epoch as this node knows it.
	Epoch int64
}
