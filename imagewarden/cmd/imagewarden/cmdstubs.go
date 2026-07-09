package main

import "fmt"

// Temporary stubs for the subcommands implemented by tasks 024, 026
// (cmdRun, cmdClassify). cmdValidate moved to validate.go (task 025);
// cmdSchema moved to schema.go (task 027); cmdHealthcheck moved to
// healthcheck.go (task 028). Each sibling task replaces its stub with a
// real implementation in its own file; remove the corresponding case here
// once that happens.

func cmdRun(args []string) int {
	fmt.Println("imagewarden run: not implemented")
	return 0
}

func cmdClassify(args []string) int {
	fmt.Println("imagewarden classify: not implemented")
	return 0
}
