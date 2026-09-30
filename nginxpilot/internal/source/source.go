// Package source defines the Source interface that keeps git and http-zip
// syncers symmetric and leaves room for future types (tar.gz, S3, OCI —
// spec §9).
package source

import (
	"context"

	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// Result reports the outcome of one sync attempt.
type Result struct {
	// Changed is false when the remote matches the deployed state — the
	// cheap no-op common case. stagingDir is untouched in that case.
	Changed bool

	// Ref identifies the fetched version (git commit SHA, or the SHA-256
	// of the archive body for http-zip).
	Ref string

	// HTTP validators to persist (http-zip only).
	ETag         string
	LastModified string

	// ContentHash is the SHA-256 of the archive body (http-zip only).
	ContentHash string
}

// LimitError is a release refused for exceeding one of source.limits. Its
// message is the sentence last_error has always carried; the fields let GET
// /status report the refusal as data (last_error_code "limit_exceeded",
// last_error_limit, last_error_limit_max), so a control plane need not parse
// the sentence.
type LimitError struct {
	// Limit is the limits key: max_archive_size | max_uncompressed_size |
	// max_entries | max_compression_ratio.
	Limit string
	// Max is the configured bound, in the limit's own unit (bytes, entries,
	// or the ratio).
	Max int64
	Msg string
}

func (e *LimitError) Error() string { return e.Msg }

// ErrorCodeLimitExceeded is the last_error_code of a LimitError.
const ErrorCodeLimitExceeded = "limit_exceeded"

// Source checks a remote for changes and, when changed, materializes the
// ready-to-serve tree into stagingDir.
type Source interface {
	// Type returns the config source type ("git" | "http-zip").
	Type() string

	// Sync compares the remote against prior state; if content changed it
	// fills stagingDir (an existing empty directory) with the new tree.
	Sync(ctx context.Context, st *state.SiteState, stagingDir string) (*Result, error)
}
