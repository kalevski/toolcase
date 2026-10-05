package cluster

import (
	"bytes"
	"encoding/json"
	"io"
	"regexp"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// Limits on what a catalog op may carry. Catalog data is admin-rate, so the
// limits are generous; they exist so that a buggy or compromised peer cannot
// make a node allocate without bound (spec §8.5 "validation on receipt").
const (
	maxOriginLen    = 80
	maxPayloadBytes = 1 << 20
	maxDefinition   = 512 << 10
	maxAttached     = 32
	maxSealed       = 8
)

var (
	originRe      = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$`)
	nodeIDRe      = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`)
	nodeNameRe    = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,62}$`)
	pipelineRe    = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,62}$`)
	bucketRe      = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`)
	accessKeyRe   = regexp.MustCompile(`^[A-Za-z0-9]{3,64}$`)
	generationRe  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$`)
	sealedFieldRe = regexp.MustCompile(`^[a-z][a-z0-9_]{0,31}$`)
	sealedTypeRe  = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,64}$`)
)

// ValidBucketName is the shape check for a bucket name in the catalog. The full
// naming rules (§3.7, including the node-local BINVAULT_DOMAIN rule) are the
// admin layer's; a received op is only checked for a shape no valid name can
// miss.
func ValidBucketName(s string) bool { return bucketRe.MatchString(s) && !strings.Contains(s, "..") }

// ValidPipelineName reports whether s is a pipeline name (§7.2).
func ValidPipelineName(s string) bool { return pipelineRe.MatchString(s) }

// ValidNodeID reports whether s can be a node id.
func ValidNodeID(s string) bool { return nodeIDRe.MatchString(s) }

// ValidNodeName reports whether s is a node name (BINVAULT_NODE_NAME).
func ValidNodeName(s string) bool { return nodeNameRe.MatchString(s) }

// splitOpID parses "origin:seq".
func splitOpID(id string) (origin string, seq int64, ok bool) {
	i := strings.LastIndexByte(id, ':')
	if i <= 0 {
		return "", 0, false
	}
	seq, err := strconv.ParseInt(id[i+1:], 10, 64)
	if err != nil || seq < 1 || !originRe.MatchString(id[:i]) {
		return "", 0, false
	}
	return id[:i], seq, true
}

// validOpID reports whether s has the shape of an op id.
func validOpID(s string) bool {
	_, _, ok := splitOpID(s)
	return ok
}

// validateOp checks an op for shape and canonical form (spec §8.5): a malformed
// or non-canonical op is refused. It does not look at who wrote the op or at
// any other op: whether an op is applied never depends on which other ops have
// arrived.
func validateOp(op *Op) error {
	switch {
	case !originRe.MatchString(op.Origin):
		return invalidf("origin %q is not a valid op stream id", clip(op.Origin))
	case op.Seq < 1:
		return invalidf("seq %d: sequence numbers start at 1", op.Seq)
	case op.HLC == 0:
		return invalidf("hlc is zero")
	case op.V < 1:
		return invalidf("protocol version %d", op.V)
	}
	return validateBody(op.Kind, op.Key, op.Prev, op.Payload)
}

// validateBody is the part of validateOp shared with snapshot registers.
func validateBody(kind, key, prev string, payload []byte) error {
	switch kind {
	case KindBucket:
		if !ValidBucketName(key) {
			return invalidf("bucket name %q", clip(key))
		}
	case KindPipeline:
		if !ValidPipelineName(key) {
			return invalidf("pipeline name %q", clip(key))
		}
	case KindKey:
		if !accessKeyRe.MatchString(key) {
			return invalidf("access key id %q", clip(key))
		}
	default:
		return invalidf("unknown kind %q", clip(kind))
	}
	if prev != "" && !validOpID(prev) {
		return invalidf("prev %q is not an op id", clip(prev))
	}
	if len(payload) == 0 || len(payload) > maxPayloadBytes {
		return invalidf("payload of %d bytes", len(payload))
	}
	canon, err := canonicalPayload(kind, payload)
	if err != nil {
		return err
	}
	if !bytes.Equal(canon, payload) {
		return invalidf("%s/%s: payload is not in canonical form", kind, clip(key))
	}
	return nil
}

func clip(s string) string {
	if len(s) > 40 {
		return s[:40] + "…"
	}
	return s
}

// canonicalPayload decodes a payload strictly, checks its fields and returns its
// canonical encoding. Two nodes that hold one op hold the same bytes, and a
// peer cannot get two different payloads accepted under one op id by varying
// whitespace, key order or number formatting: a payload must equal its own
// canonical form.
func canonicalPayload(kind string, payload []byte) ([]byte, error) {
	if isTombstone(payload) {
		return tombstonePayload, nil
	}
	switch kind {
	case KindBucket:
		var e BucketEntry
		if err := strictDecode(payload, &e); err != nil {
			return nil, invalidf("bucket entry: %v", err)
		}
		return e.canonical()
	case KindPipeline:
		var e PipelineEntry
		if err := strictDecode(payload, &e); err != nil {
			return nil, invalidf("pipeline entry: %v", err)
		}
		return e.canonical()
	case KindKey:
		var e KeyEntry
		if err := strictDecode(payload, &e); err != nil {
			return nil, invalidf("key entry: %v", err)
		}
		return e.canonical()
	}
	return nil, invalidf("unknown kind %q", clip(kind))
}

// strictDecode unmarshals one JSON value into v and refuses unknown fields and
// trailing data.
func strictDecode(data []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if _, err := dec.Token(); err != io.EOF {
		return errTrailing
	}
	return nil
}

var errTrailing = &trailingError{}

type trailingError struct{}

func (*trailingError) Error() string { return "trailing data after the JSON value" }

// canonJSON re-encodes a JSON value with sorted object keys and no
// insignificant whitespace; numbers keep their literal text.
func canonJSON(raw []byte) ([]byte, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, errTrailing
	}
	return json.Marshal(v)
}

// canonical validates the entry and returns its canonical encoding. It also
// normalises it: a nil attachment list becomes the empty list.
func (b *BucketEntry) canonical() ([]byte, error) {
	switch {
	case !nodeIDRe.MatchString(b.Home):
		return nil, invalidf("bucket home %q is not a node id", clip(b.Home))
	case b.Epoch < 0:
		return nil, invalidf("bucket epoch %d", b.Epoch)
	case !generationRe.MatchString(b.Generation):
		return nil, invalidf("bucket generation %q", clip(b.Generation))
	case b.CreatedAt < 0:
		return nil, invalidf("bucket created_at %d", b.CreatedAt)
	case len(b.Pipelines) > maxAttached:
		return nil, invalidf("bucket lists %d pipelines, at most %d", len(b.Pipelines), maxAttached)
	}
	seen := make(map[string]bool, len(b.Pipelines))
	for _, p := range b.Pipelines {
		if !ValidPipelineName(p) {
			return nil, invalidf("attached pipeline name %q", clip(p))
		}
		if seen[p] {
			return nil, invalidf("pipeline %q is attached twice", p)
		}
		seen[p] = true
	}
	if b.Pipelines == nil {
		b.Pipelines = []string{}
	}
	return json.Marshal(b)
}

func (p *PipelineEntry) canonical() ([]byte, error) {
	switch {
	case p.Revision < 1:
		return nil, invalidf("pipeline revision %d", p.Revision)
	case !generationRe.MatchString(p.Generation):
		return nil, invalidf("pipeline generation %q", clip(p.Generation))
	case len(p.Definition) == 0 || len(p.Definition) > maxDefinition:
		return nil, invalidf("pipeline definition of %d bytes", len(p.Definition))
	case len(p.Sealed) > maxSealed:
		return nil, invalidf("pipeline carries %d sealed values, at most %d", len(p.Sealed), maxSealed)
	}
	def, err := canonJSON(p.Definition)
	if err != nil {
		return nil, invalidf("pipeline definition: %v", err)
	}
	if len(def) == 0 || def[0] != '{' {
		return nil, invalidf("pipeline definition is not a JSON object")
	}
	p.Definition = def
	for field, sv := range p.Sealed {
		if !sealedFieldRe.MatchString(field) {
			return nil, invalidf("sealed field name %q", clip(field))
		}
		if !sealedTypeRe.MatchString(sv.Type) || strings.ContainsRune(sv.Type, ':') {
			return nil, invalidf("sealed %s: record type %q", field, clip(sv.Type))
		}
		if sv.ID == "" || len(sv.ID) > 128 {
			return nil, invalidf("sealed %s: record id of %d bytes", field, len(sv.ID))
		}
		if _, err := seal.SealedKeyID(sv.Value); err != nil {
			return nil, invalidf("sealed %s: %v", field, err)
		}
	}
	return json.Marshal(p)
}

func (k *KeyEntry) canonical() ([]byte, error) {
	if !ValidBucketName(k.Bucket) {
		return nil, invalidf("key entry bucket %q", clip(k.Bucket))
	}
	return json.Marshal(k)
}

// auxOf is the secondary index value of a live register: a bucket's home node
// id and a key's bucket. It is derived from the payload, so every node computes
// the same value.
func auxOf(kind string, payload []byte, deleted bool) string {
	if deleted {
		return ""
	}
	switch kind {
	case KindBucket:
		var e struct {
			Home string `json:"home"`
		}
		if json.Unmarshal(payload, &e) == nil {
			return e.Home
		}
	case KindKey:
		var e struct {
			Bucket string `json:"bucket"`
		}
		if json.Unmarshal(payload, &e) == nil {
			return e.Bucket
		}
	}
	return ""
}

// sealedKeyIDs lists the ids of the master keys that sealed the values inside an
// op's payload (only pipeline registers carry any).
func sealedKeyIDs(kind string, payload []byte) ([]seal.KeyID, error) {
	if kind != KindPipeline || isTombstone(payload) {
		return nil, nil
	}
	var e struct {
		Sealed map[string]SealedValue `json:"sealed"`
	}
	if err := json.Unmarshal(payload, &e); err != nil {
		return nil, err
	}
	var ids []seal.KeyID
	for _, sv := range e.Sealed {
		id, err := seal.SealedKeyID(sv.Value)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}
