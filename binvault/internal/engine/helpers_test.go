package engine

import (
	"os"
	"time"
)

func readDir(p string) ([]os.DirEntry, error) { return os.ReadDir(p) }
func readFile(p string) ([]byte, error)       { return os.ReadFile(p) }

type time0 = time.Time

func time0Now() time.Time { return time.Now() }

const hour = time.Hour

func writeFile(p string, b []byte) error { return os.WriteFile(p, b, 0o600) }
