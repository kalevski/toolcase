//go:build unix

package obs

import (
	"bytes"
	"os"
	"strconv"
	"syscall"
)

// readProcess reads what Unix gives every process (CPU time, the file limit) and,
// on Linux, what /proc adds (the resident size, the open files); where there is
// no /proc those two are left out.
func readProcess() processStats {
	var p processStats
	var ru syscall.Rusage
	if syscall.Getrusage(syscall.RUSAGE_SELF, &ru) == nil {
		p.cpuSeconds = float64(ru.Utime.Sec) + float64(ru.Utime.Usec)/1e6 + float64(ru.Stime.Sec) + float64(ru.Stime.Usec)/1e6
		p.hasCPU = true
	}
	// /proc/self/statm: size resident shared text lib data dt, in pages
	if b, err := os.ReadFile("/proc/self/statm"); err == nil {
		if f := bytes.Fields(b); len(f) >= 2 {
			if pages, err := strconv.ParseUint(string(f[1]), 10, 64); err == nil {
				p.rssBytes = float64(pages) * float64(os.Getpagesize())
				p.hasRSS = true
			}
		}
	}
	if ents, err := os.ReadDir("/proc/self/fd"); err == nil {
		p.openFDs = float64(len(ents) - 1) // minus the descriptor that listing the directory opened
		p.hasFDs = true
		var lim syscall.Rlimit
		if syscall.Getrlimit(syscall.RLIMIT_NOFILE, &lim) == nil {
			p.maxFDs = float64(lim.Cur)
		}
	}
	return p
}
