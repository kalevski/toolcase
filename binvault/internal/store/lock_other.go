//go:build !(linux || darwin || freebsd || netbsd || openbsd || dragonfly)

package store

import "os"

// lockDir is a no-op where there is no flock: the data directory is not locked
// there (spec §3.1).
func lockDir(string) (*os.File, error) { return nil, nil }
