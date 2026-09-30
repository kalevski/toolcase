package diskstat

import "syscall"

// blockSize is f_bsize, the unit darwin counts blocks in.
func blockSize(st *syscall.Statfs_t) uint64 {
	return uint64(st.Bsize)
}
