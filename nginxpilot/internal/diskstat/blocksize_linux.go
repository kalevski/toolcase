package diskstat

import "syscall"

// blockSize is f_frsize: on Linux the block counts are in fragment units,
// which may differ from the preferred I/O size in f_bsize.
func blockSize(st *syscall.Statfs_t) uint64 {
	if st.Frsize > 0 {
		return uint64(st.Frsize)
	}
	return uint64(st.Bsize)
}
