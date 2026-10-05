package store

import "fmt"

// lockName is the data directory's lock file (spec §3.1).
const lockName = "LOCK"

// InUseError says another process holds the data directory (spec §3.1, §2.1).
type InUseError struct{ Dir string }

func (e *InUseError) Error() string {
	return fmt.Sprintf("data dir %s is in use by another process (another binvault, or `binvault rekey`, is running on it): stop it first", e.Dir)
}

// Lock takes the data directory's exclusive lock on a store from Inspect, for a
// command that writes to the directory of a stopped node (`binvault rekey`). It
// fails with *InUseError while another process holds it. Close releases it.
func (s *Store) Lock() error {
	if s.lock != nil {
		return nil
	}
	f, err := lockDir(s.dir)
	if err != nil {
		return err
	}
	s.lock = f
	return nil
}

// Close releases the data directory's lock (a no-op for a store from Inspect
// that never took it). Close the database first: the next process to take the
// lock may open meta.db at once.
func (s *Store) Close() error {
	f := s.lock
	s.lock = nil
	if f == nil {
		return nil
	}
	return f.Close() // closing the descriptor drops the lock
}
