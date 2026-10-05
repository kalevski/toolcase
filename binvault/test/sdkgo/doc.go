// Package sdkgo is binvault's aws-sdk-go-v2 conformance suite: a nested Go module (so the main
// module's dependencies stay untouched) whose tests drive a live binvault node, found through the
// JSON file named by BV_ENV_JSON (written by test/conformance/support/bootstrap.py), with the
// current AWS SDK for Go v2 (service/s3, feature/s3/manager, feature/s3/transfermanager).
//
// Run it through test/conformance/run.sh --only sdkgo; the tests live in *_test.go.
package sdkgo
