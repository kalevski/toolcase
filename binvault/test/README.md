# binvault tests (real clients)

Everything here drives a **live binvault node** with stock S3 clients. The unit and integration tests of the
Go packages live next to the code (`go test ./...` from `binvault/`); this directory is the black-box side
(spec §12: S3 conformance, load, durability).

```
test/
  smoke.sh                  container smoke test (image build, read-only rootfs, one upload/download)
  conformance/run.sh        orchestrator: build, start a node, bootstrap buckets/tokens, run suites, print the table
  conformance/suites/<s>/   one directory per client suite (run.sh is the entry point; the first line says what it is)
  conformance/support/      shared bash/python helpers (common.sh, bootstrap.py, bvreport.py), the odd-keys table
  conformance/known-failures.tsv   findings that are tracked bugs/gaps (reported as XFAIL, not as failures)
  sdkgo/                    aws-sdk-go-v2 tests, a nested Go module (the main module is untouched)
  load/                     load and kill -9 durability tests, a nested Go module with its own runner
```

## Quick start

```bash
cd binvault/test/conformance
./run.sh                          # every client suite, 4 at a time (about 4 minutes on a laptop; the AWS CLI suite is the long pole)
./run.sh --only boto3             # one suite;  --only boto3,awscli  several
./run.sh --only load              # the load/robustness tests (about a minute; needs ~6 GiB of free disk, see below)
./run.sh --keep --only rclone     # leave the node running afterwards and print how to reach it
./run.sh --bin ./binvault         # use a prebuilt binary instead of `go build`
./run.sh --no-docker              # never use Docker: aws / rclone / node from PATH, else the suite is SKIPped
./run.sh --jobs 1 --verbose       # one suite at a time, every case printed as it finishes
```

`run.sh` builds `cmd/binvault`, starts one node on free loopback ports in a temp data dir (removed on exit; `BINVAULT_FSYNC=false`
because the functional suites do not need it, the durability tests of `load` do), and for **each suite** creates its own five
buckets through the admin API: `plain`, `versioned` (versioning + SSE-S3), `public` (anonymous read + CORS), `quota` (8 MiB) and
`ctype` (`image/png`, `image/jpeg`, `text/plain` only), each with a full-access token. Suites report one line per case
(`@@RESULT<TAB>STATUS<TAB>case<TAB>detail`); the final table lists PASS / FAIL / XFAIL / XPASS / SKIP per suite and per case.
The exit status is non-zero when any case **FAIL**s.

* **XFAIL** – the case fails and is listed in `known-failures.tsv` (a tracked binvault bug, spec gap or feature that is not
  implemented yet). It does not fail the run. **XPASS** – a listed case now passes: delete its line.
* **SKIP** – the tool could not run (no Docker, offline, image missing); the reason is printed.

Logs of the last run are kept in `$TMPDIR/binvault-conformance-logs/` (one file per suite, the node log, and `results.tsv`).
Python venvs, npm installs and the `mc` binary are cached in `$TMPDIR/binvault-conformance-cache/` (`--no-cache` discards them).
Nothing is written into the repository.

## Prerequisites

Always needed by `run.sh` itself: `bash`, `curl`, `openssl` and `python3` (3.14 was used; the harness itself needs only the standard library) — it stops with a clear message when
one is missing — and a binvault binary (`--bin PATH`, or Go to build `cmd/binvault`). Every suite below is optional: when its tool cannot
run, the suite is reported as `SKIP` with the reason (for example `sdkgo/_setup  go not found in PATH`) and does not fail the run.

| Suite | Tool and the versions of the recorded results | Needed on the machine | Without it |
|---|---|---|---|
| `boto3` | boto3 / botocore 1.43.107, pytest 9.1, pytest-timeout, awscrt (optional: CRC64NVME cases) in a venv | python3 with `venv` + `pip`; network on the first run; `curl` with HTTP/2 (one case) | SKIP (case: HTTP/2 only) |
| `sdkgo` | aws-sdk-go-v2 1.47 (`service/s3` 1.114, `feature/s3/manager`, `feature/s3/transfermanager`) | Go 1.25+ (1.26.2 used); network on the first run | SKIP |
| `sdkjs` | aws-sdk-js-v3 3.1146 (`client-s3`, `lib-storage`, `s3-request-presigner`, `s3-presigned-post`, all `latest`) on Node 22 | Docker (image `node:22`), or Node 18+ with npm; network on the first run | SKIP |
| `awscli` | AWS CLI v2 (2.37.8) | Docker (image `amazon/aws-cli`), or `aws` v2 on PATH | SKIP |
| `rclone` | rclone 1.75.1, provider `Other`, remotes from environment variables | Docker (image `rclone/rclone`), or `rclone` on PATH | SKIP |
| `mc` | MinIO client built from `go install github.com/minio/mc@latest` (MinIO publishes no images or binaries any more) | Go and network once (the binary is then cached), or `mc` on PATH | SKIP |
| `s3cmd` | s3cmd 2.4.0 in a venv | python3 with `venv` + `pip`; network on the first run | SKIP |
| `load` | purpose-written Go program, nested module `test/load`, standard library only | Go 1.25+, `ps`, about 6 GiB of free disk; not part of the default run | SKIP |

`--docker` insists on a reachable Docker daemon (fails early otherwise), `--no-docker` never uses Docker (the CLI and JS suites then need
their tool on PATH). Docker images are pulled on first use; network-dependent setups are cached in `$TMPDIR/binvault-conformance-cache/`.

## The suites

| Suite | Client | How it runs | Needs |
|---|---|---|---|
| `boto3` | boto3 / botocore (latest) under pytest, plus a raw SigV4 client for what botocore will not produce | host, python venv in the cache dir | python3, openssl, network once |
| `sdkgo` | aws-sdk-go-v2 (`service/s3`, `feature/s3/manager`, `feature/s3/transfermanager`, presign) | `go test` in `test/sdkgo` | Go, network once |
| `sdkjs` | aws-sdk-js-v3 (client-s3, lib-storage, s3-request-presigner, s3-presigned-post) | Docker `node:22` (or node from PATH) | Docker or node >= 18, network once |
| `awscli` | AWS CLI v2 (`aws s3`, `aws s3api`) | Docker `amazon/aws-cli` (or `aws` from PATH) | Docker or aws |
| `rclone` | rclone, provider `Other`, env-var config | Docker `rclone/rclone` (or `rclone` from PATH) | Docker or rclone |
| `mc` | MinIO client | MinIO no longer publishes images or binaries: built once with `go install github.com/minio/mc@latest` into the cache dir (or an `mc` from PATH) | Go, network once |
| `s3cmd` | s3cmd | host, python venv in the cache dir | python3, network once |
| `load` | purpose-written Go program (`test/load`) | starts its own nodes; **not** in the default run | Go, free disk |

What the boto3 modules cover (`suites/boto3/test_*.py`): objects, keys (the odd-keys table), listing, ranges, conditional requests,
copy, multipart (incl. UploadPartCopy and part reads), checksums (headers, trailers over a TLS proxy, hand-made `aws-chunked`
bodies in all three modes), GetObjectAttributes and tagging, versioning, SSE-S3, presigned URLs (also x-amz-* in the query), POST
Object, CORS, anonymous read, virtual-hosted style, bucket rules (quota, max_objects, max_object_bytes, sniffed content types),
lifecycle execution (the node is stopped, `meta.db` timestamps are moved into the past, the node restarted), tokens and
write-once grants, rate limits and brute-force protection, SigV4 edge cases, error documents and protocol abuse, concurrency, and
operating the binary (restart persistence, `validate`, key rotation, config errors, graceful shutdown). Black-box tests of the
rest of the surface: the admin API (`test_admin.py`: validation, revisions and `If-Match`, `PUT`/`PATCH`/`DELETE` rules, listener
separation), `GET /_metrics` (`test_metrics.py`: exposition format, series against traffic and against the admin stats),
`BINVAULT_TRUSTED_PROXIES` / `X-Forwarded-For` (`test_proxy.py`), secrets from files, built-in TLS, HTTP/2 and the admin
listener's exposure rules (`test_config.py`), the documented backup recipe, blob GC and the scrubber (`test_backup.py`),
and parsing hardening (`test_security.py`: XML entities and nesting, header injection, keys that must not reach the filesystem).

Running one suite by hand (the node and credentials come from `--keep`):

```bash
./run.sh --keep --only sdkgo               # prints the node URLs and the run directory
. $RUN_DIR/suites/sdkgo/env.sh             # BV_ENDPOINT, BV_PLAIN_BUCKET, BV_PLAIN_AK, ... (also env.json)
cd ../sdkgo && BV_ENV_JSON=$BV_ENV_JSON go test ./... -run 'TestPresign' -v
```

Knobs: `BV_PYTEST_ARGS="-k listing test_keys.py"` (boto3), `BV_GO_TEST_ARGS="-run TestOddKeys"` (sdkgo), `BV_JS_ONLY='^presign/'`
(sdkjs), `AWSCLI_GROUPS="s3 api"`, `RCLONE_GROUPS="copy multi"`, `MC_GROUPS="basic"`, `S3CMD_GROUPS="basic"`,
`BV_SLOW=0` (skip the two cases that wait for a timer: `last_used_at` about 50 s, the blob GC tick about 60 s), `BV_KEEP_TMP=1`
(keep the temp directories of the private nodes the boto3 suite starts, for a post-mortem).

## Reading a result

Each case id is `area/what`. A failure line carries the observed status/error code; the full request/response details are in the
suite log. Failures are triaged as (1) a binvault bug against the spec, (2) a spec or compatibility gap (real AWS S3 is the
reference where the spec is silent) or (3) a test mistake / client quirk. Only (1) and (2) go into `known-failures.tsv`, with a
`BV-nn` finding id and a one-line reason that names the likely place in `internal/`. A case is never weakened to make it pass.

Two traps of the shell suites are worth knowing. S3 timestamps are whole seconds (binvault's listings match AWS here), so
a local file written in the same second as its upload looks "newer than the object" to `aws s3 sync` and `mc diff`: a test that
syncs or diffs the same files twice ages them first with `bv_age_files DIR` (support/common.sh). And `$(...)` drops NUL bytes
and trailing newlines, so random binary output is compared through a file or as hex, never as a bash string.

## Load tests

`./run.sh --only load` (or `bash test/load/run.sh` directly) runs, against nodes of its own:

* a 1 GiB multipart upload (16 parts, 4 in flight), the full download and 24 ranged reads, with the server's RSS sampled throughout
  (it stays at tens of MiB; the case fails if it ever exceeds half the object size), plus a 256 MiB single PUT;
* 20,000 small objects PUT with 16 workers (throughput and p50/p95/p99 latency are printed), all read back;
* the 20,000 keys listed flat and with a delimiter, paging at 1000, count and raw UTF-8 byte order checked (ASCII, Latin, CJK,
  supplementary-plane keys);
* `kill -9` during a large PUT, an overwrite, a part upload, six moments of a multipart Complete and a storm of small PUTs
  (`BINVAULT_FSYNC=true`): `binvault validate --deep` on the crashed directory, restart on the same data dir, then no partial object
  visible, `tmp/` empty, the old version of an overwritten key intact, the open multipart upload still completable, every
  acknowledged PUT present and intact.

It prints numbers (`# ...` lines) and asserts only functional properties. Knobs: `BV_LOAD_SCALE=0.1` (quick smoke run, a few seconds),
`BV_LOAD_ONLY=bigmpu,small,kill`, `BV_LOAD_DIR=/big/disk` (where the data dirs go), `BV_LOAD_NO_KILL=1`, `BV_BIN=/path/to/binvault`.
