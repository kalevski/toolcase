package obs

import (
	"fmt"
	"io"
	"runtime"
	"runtime/debug"
	"time"
)

// runtimeMetrics is the Go runtime and process metrics of spec §9.2, read once per
// scrape. The names are the standard ones Prometheus dashboards expect
// (go_goroutines, go_threads, go_gc_duration_seconds, go_memstats_*,
// process_cpu_seconds_total, process_resident_memory_bytes, process_open_fds, ...),
// written by hand so that no client library is needed; process_uptime_seconds and
// go_gc_cycles_total are binvault's own. A figure the platform cannot give (the
// resident size and open files outside Linux) is left out.
type runtimeMetrics struct{ start time.Time }

func (runtimeMetrics) name() string { return "go_runtime_and_process" }

func (m runtimeMetrics) write(w io.Writer) {
	family := func(name, typ, help string, v float64) {
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s %s\n%s %s\n", name, help, name, typ, name, fmtFloat(v))
	}

	family("go_goroutines", "gauge", "Number of goroutines.", float64(runtime.NumGoroutine()))
	threads, _ := runtime.ThreadCreateProfile(nil)
	family("go_threads", "gauge", "Number of OS threads created.", float64(threads))
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	family("go_memstats_alloc_bytes", "gauge", "Bytes of allocated heap objects.", float64(ms.Alloc))
	family("go_memstats_sys_bytes", "gauge", "Bytes obtained from the system.", float64(ms.Sys))

	// GC: the cycle count is a counter, the pauses a summary over the recent ones
	gc := debug.GCStats{PauseQuantiles: make([]time.Duration, 5)}
	debug.ReadGCStats(&gc)
	family("go_gc_cycles_total", "counter", "Completed GC cycles.", float64(gc.NumGC))
	fmt.Fprint(w, "# HELP go_gc_duration_seconds A summary of the pause duration of garbage collection cycles.\n# TYPE go_gc_duration_seconds summary\n")
	for i, q := range []string{"0", "0.25", "0.5", "0.75", "1"} {
		fmt.Fprintf(w, "go_gc_duration_seconds{quantile=%q} %s\n", q, fmtFloat(gc.PauseQuantiles[i].Seconds()))
	}
	fmt.Fprintf(w, "go_gc_duration_seconds_sum %s\ngo_gc_duration_seconds_count %d\n", fmtFloat(gc.PauseTotal.Seconds()), gc.NumGC)

	family("process_start_time_seconds", "gauge", "Start time of the process, seconds since the Unix epoch.", float64(m.start.UnixNano())/1e9)
	family("process_uptime_seconds", "gauge", "Seconds since the process started.", time.Since(m.start).Seconds())
	p := readProcess()
	if p.hasCPU {
		family("process_cpu_seconds_total", "counter", "Total user and system CPU time spent, in seconds.", p.cpuSeconds)
	}
	if p.hasRSS {
		family("process_resident_memory_bytes", "gauge", "Resident memory size in bytes.", p.rssBytes)
	}
	if p.hasFDs {
		family("process_open_fds", "gauge", "Number of open file descriptors.", p.openFDs)
		if p.maxFDs > 0 {
			family("process_max_fds", "gauge", "Maximum number of open file descriptors.", p.maxFDs)
		}
	}
}

// processStats are the process-level figures a platform can give; hasX says
// whether X is available.
type processStats struct {
	cpuSeconds float64
	rssBytes   float64
	openFDs    float64
	maxFDs     float64

	hasCPU, hasRSS, hasFDs bool
}
