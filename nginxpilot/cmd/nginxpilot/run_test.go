package main

import (
	"testing"
)

func TestResolveAdminToken(t *testing.T) {
	tests := []struct {
		name     string
		envKey   string
		envValue string // value to set; "" means do not set
		setEnv   bool
		wantErr  bool
		wantVal  string
	}{
		{
			name:    "no token_env configured returns empty string no error",
			envKey:  "",
			wantErr: false,
			wantVal: "",
		},
		{
			name:     "token_env set and variable has value returns token",
			envKey:   "TEST_ADMIN_TOKEN_SET",
			envValue: "supersecret",
			setEnv:   true,
			wantErr:  false,
			wantVal:  "supersecret",
		},
		{
			name:    "token_env set but variable unset returns error",
			envKey:  "TEST_ADMIN_TOKEN_MISSING",
			setEnv:  false,
			wantErr: true,
		},
		{
			name:     "token_env set but variable empty returns error",
			envKey:   "TEST_ADMIN_TOKEN_EMPTY",
			envValue: "",
			setEnv:   true,
			wantErr:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.setEnv {
				t.Setenv(tc.envKey, tc.envValue)
			}
			got, err := resolveAdminToken(tc.envKey)
			if (err != nil) != tc.wantErr {
				t.Fatalf("resolveAdminToken(%q) error = %v, wantErr %v", tc.envKey, err, tc.wantErr)
			}
			if !tc.wantErr && got != tc.wantVal {
				t.Fatalf("resolveAdminToken(%q) = %q, want %q", tc.envKey, got, tc.wantVal)
			}
		})
	}
}
