// Package pipeline implements binvault's pipelines (spec §7): admin-defined
// procedures that call an external service for every object event, either
// before the write becomes visible (the before chain) or after it has been
// committed (the outbox, the scheduler and the backfills). The service gets a
// short-lived token for the S3 API; binvault acts only on the HTTP status it
// answers with.
//
// State is of two kinds, kept apart so that a cluster can later give every home
// node its own copy of the first (spec §8.7):
//
//   - persisted state, in package meta: pipeline definitions with their sealed
//     secrets, attachments, runs, backfills;
//   - node-local state, owned by the Manager: the pipeline and attachment
//     caches, the pipeline tokens, the concurrency slots, the scheduler and the
//     backfill walkers. None of it is stored or replicated; a restart rebuilds
//     it from the persisted state.
//
// Layout
//
//	definition.go   the definition, its defaults and validation (§7.2)
//	pipe.go         a resolved pipeline (opened secrets), sealing, the cache
//	attach.go       attachments and their revision-validated cache (§6.6)
//	match.go        the matcher (§7.3); grants.go expands token templates (§7.8)
//	tokens.go       the pipeline-token registry (implements s3.PipelineTokens)
//	staged.go       the staged view of before runs (§7.8)
//	invoke.go       the HTTP invoker; safety.go the outbound address rules (§7.13);
//	                payload.go the invocation body (§7.6)
//	outbox.go       the transactional outbox: after runs are created in the
//	                commit transaction (§7.10)
//	scheduler.go    dispatch of queued after runs; exec.go executes one;
//	                decide.go decides retry, failure or success
//	before.go       the before chain: write chains with the staged view, delete
//	                chains with a read-only token (§7.9)
//	backfill.go     backfills (§6.8)
//	routes*.go      the admin API (§6.5 to §6.8)
//
// The stale-write guard of after tokens (§7.8) is enforced where the data is
// touched, in packages engine and s3, from the guard each token carries.
package pipeline
