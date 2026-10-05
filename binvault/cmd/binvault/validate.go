package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

func cmdValidate(args []string) int {
	fs := flag.NewFlagSet("validate", flag.ContinueOnError)
	deep := fs.Bool("deep", false, "also verify that every referenced blob exists")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "validate takes no arguments (only --deep), got %q\n", fs.Args())
		return 2
	}
	cfg, _, code := loadConfig()
	if cfg == nil {
		return code
	}
	rep, err := app.Validate(context.Background(), cfg, *deep)
	for _, line := range rep.Info {
		fmt.Println("ok:", line)
	}
	for _, p := range rep.Problems {
		fmt.Fprintln(os.Stderr, "PROBLEM:", p)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "validate failed:", err)
		return 1
	}
	if len(rep.Problems) > 0 {
		return 1
	}
	fmt.Println("validate: all checks passed")
	return 0
}
