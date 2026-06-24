package main

import "testing"

func TestTruncate(t *testing.T) {
	tests := []struct {
		name string
		s    string
		n    int
		want string
	}{
		{
			name: "short string unchanged",
			s:    "hello",
			n:    10,
			want: "hello",
		},
		{
			name: "exact length unchanged",
			s:    "hello",
			n:    5,
			want: "hello",
		},
		{
			name: "long ASCII truncated with ellipsis",
			s:    "abcdefghij",
			n:    6,
			want: "abcde…",
		},
		{
			name: "multi-byte runes not split",
			s:    "héllo wörld",
			n:    6,
			want: "héllo…",
		},
		{
			name: "CJK runes not split",
			s:    "日本語テスト",
			n:    4,
			want: "日本語…",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := truncate(tc.s, tc.n)
			if got != tc.want {
				t.Fatalf("truncate(%q, %d) = %q, want %q", tc.s, tc.n, got, tc.want)
			}
		})
	}
}

func TestNormalizeListenAddr(t *testing.T) {
	tests := []struct {
		name   string
		listen string
		want   string
	}{
		{
			name:   "empty host rewritten to 127.0.0.1",
			listen: ":9090",
			want:   "127.0.0.1:9090",
		},
		{
			name:   "0.0.0.0 rewritten to 127.0.0.1",
			listen: "0.0.0.0:9090",
			want:   "127.0.0.1:9090",
		},
		{
			name:   ":: rewritten to 127.0.0.1",
			listen: "[::]:9090",
			want:   "127.0.0.1:9090",
		},
		{
			name:   "specific host left unchanged",
			listen: "192.168.1.1:9090",
			want:   "192.168.1.1:9090",
		},
		{
			name:   "localhost left unchanged",
			listen: "localhost:9090",
			want:   "localhost:9090",
		},
		{
			name:   "127.0.0.1 left unchanged",
			listen: "127.0.0.1:9090",
			want:   "127.0.0.1:9090",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeListenAddr(tc.listen)
			if got != tc.want {
				t.Fatalf("normalizeListenAddr(%q) = %q, want %q", tc.listen, got, tc.want)
			}
		})
	}
}
