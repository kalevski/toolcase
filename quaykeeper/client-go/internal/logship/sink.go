package logship

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Sink delivers one batch to a destination. Send is called by a single worker
// goroutine per destination; implementations need no internal ordering.
// batchID is stable across retries of the same batch (the caller generates it
// once per batch, not per attempt) so a dedupe-capable consumer can recognize
// a replay.
type Sink interface {
	Send(ctx context.Context, batch []Entry, batchID string) error
	Close() error
}

// sendError classifies a delivery failure for the worker's retry loop.
type sendError struct {
	err        error
	permanent  bool
	retryAfter time.Duration
}

func (e *sendError) Error() string { return e.err.Error() }
func (e *sendError) Unwrap() error { return e.err }

func newSink(d *Destination) (Sink, error) {
	switch d.Type {
	case DestStdout:
		return &writerSink{w: os.Stdout}, nil
	case DestFile:
		return newFileSink(d)
	case DestHTTP:
		return newHTTPSink(d)
	case DestLoki:
		return newLokiSink(d)
	}
	return nil, fmt.Errorf("unknown destination type %q", d.Type)
}

// writerSink writes NDJSON lines to an io.Writer (stdout destination).
type writerSink struct {
	mu sync.Mutex
	w  io.Writer
}

func (s *writerSink) Send(_ context.Context, batch []Entry, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range batch {
		if _, err := s.w.Write(append(e.Raw, '\n')); err != nil {
			return &sendError{err: err, permanent: true}
		}
	}
	return nil
}

func (s *writerSink) Close() error { return nil }

// fileSink appends NDJSON to a local file with size-based self-rotation.
type fileSink struct {
	path     string
	maxSize  int64
	maxFiles int
	f        *os.File
	size     int64
}

func newFileSink(d *Destination) (Sink, error) {
	maxSize := d.MaxSize
	if maxSize <= 0 {
		maxSize = DefaultFileMaxSize
	}
	maxFiles := d.MaxFiles
	if maxFiles <= 0 {
		maxFiles = DefaultFileMaxFiles
	}
	if err := os.MkdirAll(filepath.Dir(d.Path), 0o750); err != nil {
		return nil, err
	}
	return &fileSink{path: d.Path, maxSize: maxSize, maxFiles: maxFiles}, nil
}

func (s *fileSink) Send(_ context.Context, batch []Entry, _ string) error {
	if err := s.open(); err != nil {
		return &sendError{err: err}
	}
	for _, e := range batch {
		n, err := s.f.Write(append(e.Raw, '\n'))
		s.size += int64(n)
		if err != nil {
			return &sendError{err: err}
		}
		if s.size >= s.maxSize {
			if err := s.rotate(); err != nil {
				return &sendError{err: err}
			}
		}
	}
	return nil
}

func (s *fileSink) open() error {
	if s.f != nil {
		return nil
	}
	f, err := os.OpenFile(s.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	fi, err := f.Stat()
	if err != nil {
		f.Close()
		return err
	}
	s.f, s.size = f, fi.Size()
	return nil
}

func (s *fileSink) rotate() error {
	if err := s.f.Close(); err != nil {
		s.f = nil
		return err
	}
	s.f = nil
	_ = os.Remove(fmt.Sprintf("%s.%d", s.path, s.maxFiles-1))
	for i := s.maxFiles - 2; i >= 1; i-- {
		_ = os.Rename(fmt.Sprintf("%s.%d", s.path, i), fmt.Sprintf("%s.%d", s.path, i+1))
	}
	if s.maxFiles > 1 {
		if err := os.Rename(s.path, s.path+".1"); err != nil && !os.IsNotExist(err) {
			return err
		}
	} else {
		_ = os.Remove(s.path)
	}
	return s.open()
}

func (s *fileSink) Close() error {
	if s.f == nil {
		return nil
	}
	err := s.f.Close()
	s.f = nil
	return err
}
