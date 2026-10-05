package config

import (
	"fmt"
	"strings"
)

// Problem is one invalid setting found by Load.
type Problem struct {
	// Var names the variable at fault, such as BINVAULT_LISTEN or
	// BINVAULT_MASTER_KEY_FILE.
	Var string
	// Msg says what is wrong and, where it helps, how to fix it. It never
	// contains a secret value.
	Msg string
}

// String renders the problem as "VAR: message".
func (p Problem) String() string { return p.Var + ": " + p.Msg }

// Error is the error Load returns. It holds every problem found, not just the
// first: the variables' own problems in table order, then those of the rules
// that span several variables.
type Error struct {
	Problems []Problem
}

// Error renders one problem as "VAR: message", and several as a count
// followed by one indented "VAR: message" line each.
func (e *Error) Error() string {
	switch len(e.Problems) {
	case 0:
		return "invalid configuration"
	case 1:
		return e.Problems[0].String()
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%d configuration problems:", len(e.Problems))
	for _, p := range e.Problems {
		b.WriteString("\n  ")
		b.WriteString(p.String())
	}
	return b.String()
}
