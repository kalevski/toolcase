package store

import "sync"

// 256 KiB copy buffers keep memory independent of object size (spec §3.5).
var bufPool = sync.Pool{New: func() any { b := make([]byte, 256<<10); return &b }}

// Buffer returns a pooled copy buffer; give it back with PutBuffer.
func Buffer() *[]byte { return bufPool.Get().(*[]byte) }

// PutBuffer returns a buffer from Buffer.
func PutBuffer(b *[]byte) { bufPool.Put(b) }
