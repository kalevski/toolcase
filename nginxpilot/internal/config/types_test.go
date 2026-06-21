package config

import (
	"testing"
)

func intPtr(v int) *int { return &v }

func TestSiteKeepReleases(t *testing.T) {
	tests := []struct {
		name         string
		siteKeep     *int
		defaultKeep  int
		want         int
	}{
		{
			name:        "per-site value wins over defaults and built-in",
			siteKeep:    intPtr(7),
			defaultKeep: 3,
			want:        7,
		},
		{
			name:        "falls back to defaults when site value is nil",
			siteKeep:    nil,
			defaultKeep: 3,
			want:        3,
		},
		{
			name:        "falls back to defaults when site value is zero",
			siteKeep:    intPtr(0),
			defaultKeep: 3,
			want:        3,
		},
		{
			name:        "falls back to built-in when both site and defaults are zero",
			siteKeep:    nil,
			defaultKeep: 0,
			want:        defaultKeepReleases,
		},
		{
			name:        "falls back to built-in when site value is zero and defaults is zero",
			siteKeep:    intPtr(0),
			defaultKeep: 0,
			want:        defaultKeepReleases,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			site := Site{Source: Source{KeepReleases: tc.siteKeep}}
			defaults := Defaults{KeepReleases: tc.defaultKeep}
			got := site.KeepReleases(defaults)
			if got != tc.want {
				t.Errorf("KeepReleases() = %d, want %d", got, tc.want)
			}
		})
	}
}

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
