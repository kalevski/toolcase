package auth

import (
	"fmt"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Principal kinds.
const (
	KindToken     = "token"
	KindPipeline  = "pipeline"
	KindAnonymous = "anonymous"
)

// Principal is an authenticated caller of the S3 API.
type Principal struct {
	Kind      string
	AccessKey string
	Name      string // token name, or pipeline name
	Bucket    string
	Grants    Grants
	Limits    meta.Limits

	// Run identifies the pipeline run behind a pipeline token ("" otherwise).
	Run string
	// Pipeline carries the pipeline-token specifics (staged view, lineage);
	// set by the pipeline package, opaque here.
	Pipeline any
}

// Anonymous returns the unauthenticated principal for a bucket.
func Anonymous(bucket string) *Principal {
	return &Principal{Kind: KindAnonymous, Bucket: bucket}
}

// Label is how the principal appears in logs (spec §9.1).
func (p *Principal) Label() string {
	switch p.Kind {
	case KindToken:
		return "token:" + p.AccessKey
	case KindPipeline:
		return fmt.Sprintf("pipeline:%s/%s", p.Name, p.Run)
	}
	return "anonymous"
}
