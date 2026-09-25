package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// cmdBackup writes a consistent online copy of the replicated store (safe
// while the daemon runs). Restoring it is safe too: on start the node pulls
// back any of its own ops its peers hold that the backup lacks.
func cmdBackup(args []string) int {
	fs := flag.NewFlagSet("backup", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	target, ok := parseWithPositional(fs, args, "usage: zonewright backup <file> [--config PATH]")
	if !ok {
		return 2
	}
	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	db := filepath.Join(res.Config.DataDir, "zonewright.db")
	if _, err := os.Stat(db); err != nil {
		fmt.Fprintf(os.Stderr, "no store at %s: %v\n", db, err)
		return 1
	}
	if _, err := os.Stat(target); err == nil {
		fmt.Fprintf(os.Stderr, "%s already exists; refusing to overwrite\n", target)
		return 1
	}
	st, err := store.Open(db, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer st.Close()
	if err := st.Backup(target); err != nil {
		fmt.Fprintf(os.Stderr, "backup failed: %v\n", err)
		return 1
	}
	fmt.Printf("backup of node %s written to %s\n", st.NodeID(), target)
	return 0
}
