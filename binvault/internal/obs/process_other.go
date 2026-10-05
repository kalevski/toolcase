//go:build !unix

package obs

// readProcess has nothing to report where there is no Getrusage and no /proc.
func readProcess() processStats { return processStats{} }
