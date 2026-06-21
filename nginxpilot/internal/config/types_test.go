package config

import (
	"testing"
)

func TestParseByteSize(t *testing.T) {
	tests := []struct {
		input   string
		want    ByteSize
		wantErr bool
	}{
		{"512MiB", 512 << 20, false},
		{"2GiB", 2 << 30, false},
		{"1048576", 1 << 20, false},
		{"0", 0, false},
		{"1B", 1, false},
		{"notasize", 0, true},
		{"99999999TiB", 0, true},
	}

	for _, tc := range tests {
		got, err := ParseByteSize(tc.input)
		if tc.wantErr {
			if err == nil {
				t.Errorf("ParseByteSize(%q): expected error, got %d", tc.input, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("ParseByteSize(%q): unexpected error: %v", tc.input, err)
			continue
		}
		if got != tc.want {
			t.Errorf("ParseByteSize(%q): got %d, want %d", tc.input, got, tc.want)
		}
	}
}
