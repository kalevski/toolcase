// Package imaging decodes untrusted image bytes and turns them into the
// float32 tensor the model consumes. All failures surface as one of the
// sentinels in errors.go so internal/api can map them to stable HTTP status
// codes.
package imaging
