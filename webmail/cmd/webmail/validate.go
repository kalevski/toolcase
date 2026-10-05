package main

import (
	"context"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/webmail/internal/server"
)

func cmdValidate(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "validate takes no arguments")
		return 2
	}
	cfg, code := loadConfig()
	if cfg == nil {
		return code
	}
	rep, err := server.Validate(context.Background(), cfg)
	if rep != nil {
		for _, l := range rep.Info {
			fmt.Println("ok:", l)
		}
		for _, p := range rep.Problems {
			fmt.Fprintln(os.Stderr, "PROBLEM:", p)
		}
	}
	if err != nil || (rep != nil && len(rep.Problems) > 0) {
		if err != nil {
			fmt.Fprintln(os.Stderr, "validate failed:", err)
		}
		return 1
	}
	fmt.Println("validate: all checks passed")
	return 0
}
