package engine

import "strings"

func splitComma(s string) []string  { return strings.Split(s, ",") }
func trimSpace(s string) string     { return strings.TrimSpace(s) }
func trimPrefix(s, p string) string { return strings.TrimPrefix(s, p) }
func trimQuotes(s string) string {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}
