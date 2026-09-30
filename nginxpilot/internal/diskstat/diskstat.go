// Package diskstat reports the size and use of the filesystem holding a path,
// so GET /status can say how full the disk under data_dir is. A control plane
// uses it to bound how many sites a host can still take without running a
// second agent on the machine just to measure its disk.
package diskstat

import "syscall"

// Usage is one filesystem's figures, in bytes.
//
// UsedBytes + AvailableBytes is usually less than TotalBytes: the difference is
// the blocks reserved for root, which an unprivileged process cannot use.
// Capacity planning should treat UsedBytes + AvailableBytes as the disk.
type Usage struct {
	Path           string `json:"path"`
	TotalBytes     uint64 `json:"total_bytes"`
	UsedBytes      uint64 `json:"used_bytes"`
	AvailableBytes uint64 `json:"available_bytes"`
}

// Of statfs'es path.
func Of(path string) (Usage, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return Usage{Path: path}, err
	}
	size := blockSize(&st)
	return Usage{
		Path:           path,
		TotalBytes:     st.Blocks * size,
		UsedBytes:      (st.Blocks - st.Bfree) * size,
		AvailableBytes: st.Bavail * size,
	}, nil
}
