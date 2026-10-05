//go:build linux || darwin || freebsd || netbsd || openbsd || dragonfly

package store

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
)

// lockDir takes an exclusive, non-blocking flock on <dir>/LOCK. The lock lives as
// long as the returned file stays open, so it ends with the process, kill -9
// included. A filesystem that has no flock (ENOSYS, ENOTSUP, ENOLCK) runs
// unlocked, as binvault did before the lock existed.
func lockDir(dir string) (*os.File, error) {
	p := filepath.Join(dir, lockName)
	f, err := os.OpenFile(p, os.O_RDWR|os.O_CREATE, 0o640)
	if errors.Is(err, fs.ErrPermission) {
		return nil, fmt.Errorf("store: %w (the data dir and its LOCK file must belong to the user that runs binvault; `binvault rekey` has to run as that user too, not as root)", err)
	}
	if err != nil {
		return nil, fmt.Errorf("store: %w", err)
	}
	for {
		err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if !errors.Is(err, syscall.EINTR) {
			break
		}
	}
	switch {
	case err == nil:
		return f, nil
	case errors.Is(err, syscall.EWOULDBLOCK):
		f.Close()
		return nil, &InUseError{Dir: dir}
	case errors.Is(err, syscall.ENOSYS), errors.Is(err, syscall.ENOTSUP), errors.Is(err, syscall.EOPNOTSUPP), errors.Is(err, syscall.ENOLCK):
		return f, nil
	}
	f.Close()
	return nil, fmt.Errorf("store: locking %s: %w", p, err)
}
