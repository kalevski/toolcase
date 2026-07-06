package htpasswd

import (
	"strings"
	"testing"
)

// Vectors generated with `openssl passwd -apr1 -salt <salt> <password>`.
func TestHashWithSaltVectors(t *testing.T) {
	cases := []struct{ password, salt, want string }{
		{"myPassword", "abcdefgh", "$apr1$abcdefgh$EfExgQSMBXioDhIVk8IOb1"},
		{"s3cret!", "12345678", "$apr1$12345678$lLGr0c4EAsPsMrwfnBQu40"},
	}
	for _, c := range cases {
		if got := HashWithSalt(c.password, c.salt); got != c.want {
			t.Errorf("HashWithSalt(%q, %q) = %q, want %q", c.password, c.salt, got, c.want)
		}
	}
}

func TestHashUsesFreshSaltAndVerifies(t *testing.T) {
	h1, err := Hash("hunter2")
	if err != nil {
		t.Fatal(err)
	}
	h2, err := Hash("hunter2")
	if err != nil {
		t.Fatal(err)
	}
	if h1 == h2 {
		t.Error("two hashes of the same password should differ (fresh salts)")
	}
	// Re-derive from the embedded salt and compare.
	parts := strings.Split(h1, "$") // "", "apr1", salt, hash
	if len(parts) != 4 || parts[1] != "apr1" {
		t.Fatalf("unexpected hash shape %q", h1)
	}
	if HashWithSalt("hunter2", parts[2]) != h1 {
		t.Error("hash does not verify against its own salt")
	}
	if HashWithSalt("wrong", parts[2]) == h1 {
		t.Error("wrong password must not verify")
	}
}

func TestLongPasswords(t *testing.T) {
	// > 16 bytes exercises the alt-digest loop.
	long := strings.Repeat("correct horse battery staple ", 3)
	h, err := Hash(long)
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(h, "$")
	if HashWithSalt(long, parts[2]) != h {
		t.Error("long password does not round-trip")
	}
}
