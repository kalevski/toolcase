package config

import (
	"fmt"
	"os"
	"strings"
	"syscall"
)

// ResolveSecret resolves an env/file secret reference pair (exactly one is
// set, enforced at validation time) to its value.
//
// File-backed secrets must be 0600 or 0640 and owned by the daemon user or
// root; anything looser is a hard error (ssh-style strictness, spec Q9/§7).
func ResolveSecret(envName, fileName string) (string, error) {
	if envName != "" {
		v, ok := os.LookupEnv(envName)
		if !ok {
			return "", fmt.Errorf("environment variable %s is not set", envName)
		}
		return strings.TrimSpace(v), nil
	}
	if err := CheckSecretFile(fileName); err != nil {
		return "", err
	}
	raw, err := os.ReadFile(fileName)
	if err != nil {
		return "", fmt.Errorf("read secret file: %w", err)
	}
	return strings.TrimSpace(string(raw)), nil
}

// CheckSecretRef verifies a secret reference resolves (existence only —
// what `validate` runs; values are not read).
func CheckSecretRef(envName, fileName string) error {
	if envName != "" {
		if _, ok := os.LookupEnv(envName); !ok {
			return fmt.Errorf("environment variable %s is not set", envName)
		}
		return nil
	}
	return CheckSecretFile(fileName)
}

// CheckSecretFile enforces permission and ownership rules on a secret file.
func CheckSecretFile(path string) error {
	fi, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("secret file %s: %w", path, err)
	}
	if !fi.Mode().IsRegular() {
		return fmt.Errorf("secret file %s: not a regular file", path)
	}
	perm := fi.Mode().Perm()
	if perm != 0o600 && perm != 0o640 && perm != 0o400 && perm != 0o440 {
		return fmt.Errorf("secret file %s: mode %04o too permissive (must be 0600 or 0640)", path, perm)
	}
	if st, ok := fi.Sys().(*syscall.Stat_t); ok {
		uid := uint32(os.Getuid())
		if st.Uid != 0 && st.Uid != uid {
			return fmt.Errorf("secret file %s: owned by uid %d, must be owned by the daemon user (uid %d) or root", path, st.Uid, uid)
		}
	}
	return nil
}

// SecretRefs lists every env/file secret reference an Auth block uses —
// used by `validate` to check resolvability without reading values.
func (a Auth) SecretRefs() [][2]string {
	var refs [][2]string
	add := func(env, file string) {
		if env != "" || file != "" {
			refs = append(refs, [2]string{env, file})
		}
	}
	add(a.TokenEnv, a.TokenFile)
	add(a.PasswordEnv, a.PasswordFile)
	add(a.ValueEnv, a.ValueFile)
	return refs
}
