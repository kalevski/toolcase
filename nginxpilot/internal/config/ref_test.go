package config

import (
	"strings"
	"testing"
)

func gitSource(ref string) *Source {
	return &Source{Type: SourceGit, URL: "https://github.com/o/r.git", Branch: "main", Ref: ref}
}

func TestValidateGitRefFullSHAAccepted(t *testing.T) {
	for _, ref := range []string{strings.Repeat("a", 40), strings.Repeat("0", 64)} {
		if err := validateSource(gitSource(ref)); err != nil {
			t.Fatalf("ref %s: %v", ref, err)
		}
	}
}

func TestValidateGitRefRejected(t *testing.T) {
	for _, ref := range []string{"main", "abc1234", strings.Repeat("A", 40), strings.Repeat("g", 40), strings.Repeat("a", 41)} {
		if err := validateSource(gitSource(ref)); err == nil || !strings.Contains(err.Error(), "source.ref") {
			t.Fatalf("ref %q: want a source.ref error, got %v", ref, err)
		}
	}
}

func TestValidateRefOnHTTPZipRejected(t *testing.T) {
	src := &Source{Type: SourceHTTPZip, URL: "https://example.com/site.zip", Ref: strings.Repeat("a", 40)}
	if err := validateSource(src); err == nil || !strings.Contains(err.Error(), "only apply to git sources") {
		t.Fatalf("want a git-only error, got %v", err)
	}
}
