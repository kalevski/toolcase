package main

import (
	"context"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

func cmdRekey(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "rekey takes no arguments")
		return 2
	}
	cfg, _, code := loadConfig()
	if cfg == nil {
		return code
	}
	n, err := app.RekeyDataDir(context.Background(), cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "rekey failed:", err)
		return 1
	}
	fmt.Printf("rekey: %d sealed value(s) re-sealed under the current master key\n", n)
	return 0
}
