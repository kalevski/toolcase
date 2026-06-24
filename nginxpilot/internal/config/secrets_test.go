package config

import (
	"os"
	"testing"
)

func TestCheckSecretFile(t *testing.T) {
	tests := []struct {
		name    string
		perm    os.FileMode
		wantErr bool
	}{
		{name: "0600 passes", perm: 0o600, wantErr: false},
		{name: "0640 passes", perm: 0o640, wantErr: false},
		{name: "0400 passes", perm: 0o400, wantErr: false},
		{name: "0440 passes", perm: 0o440, wantErr: false},
		{name: "0644 rejected", perm: 0o644, wantErr: true},
		{name: "0666 rejected", perm: 0o666, wantErr: true},
		{name: "0777 rejected", perm: 0o777, wantErr: true},
		{name: "0604 rejected", perm: 0o604, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f, err := os.CreateTemp(t.TempDir(), "secret-*")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := f.WriteString("secret"); err != nil {
				t.Fatal(err)
			}
			if err := f.Close(); err != nil {
				t.Fatal(err)
			}
			if err := os.Chmod(f.Name(), tc.perm); err != nil {
				t.Fatal(err)
			}

			err = CheckSecretFile(f.Name())
			if tc.wantErr && err == nil {
				t.Fatalf("mode %04o: expected error, got nil", tc.perm)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("mode %04o: unexpected error: %v", tc.perm, err)
			}
		})
	}
}

func TestCheckSecretFileMissing(t *testing.T) {
	err := CheckSecretFile(t.TempDir() + "/nonexistent.key")
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

func TestCheckSecretFileDirectory(t *testing.T) {
	dir := t.TempDir()
	// os.Stat reports a directory, not a regular file.
	err := CheckSecretFile(dir)
	if err == nil {
		t.Fatal("expected error for directory, got nil")
	}
}
