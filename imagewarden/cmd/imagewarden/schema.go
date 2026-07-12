package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/imagewarden/internal/api"
)

// cmdSchema prints the API schema JSON to stdout (spec §7), reusing
// api.SchemaJSON() so this command and GET /schema can never diverge —
// SchemaJSON already returns indented bytes, so there is no second
// pretty-printing pass to keep in sync.
func cmdSchema(args []string) int {
	fs := flag.NewFlagSet("schema", flag.ExitOnError)
	_ = fs.Parse(args)

	b, err := api.SchemaJSON()
	if err != nil {
		fmt.Fprintf(os.Stderr, "schema error: %v\n", err)
		return 1
	}
	os.Stdout.Write(b)
	fmt.Println()
	return 0
}
