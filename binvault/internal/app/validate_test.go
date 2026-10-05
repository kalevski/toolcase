package app_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// An upgrade validates before it migrates (the packaged unit runs `validate` before
// `run`): a database older than the binary's schema is "migration pending", not a
// failure, and the checks that need the new schema run after the migration (spec §9.6).
func TestValidateOnAnOlderDatabase(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	cfg := cfgFor(dir, key32())
	want := meta.SchemaVersion()
	for _, old := range []int{1, want - 1} {
		if err := os.RemoveAll(dir); err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(dir, 0o750); err != nil {
			t.Fatal(err)
		}
		if err := meta.MigrateTo(ctx, filepath.Join(dir, "meta.db"), old); err != nil {
			t.Fatal(err)
		}
		for _, deep := range []bool{false, true} {
			rep, err := app.Validate(ctx, cfg, deep)
			if err != nil || len(rep.Problems) != 0 {
				t.Fatalf("schema %d, deep=%v: validate must not fail an upgrade that has a migration pending: %v %v", old, deep, rep.Problems, err)
			}
			info := strings.Join(rep.Info, "\n")
			pending := fmt.Sprintf("migration pending (%d to %d): the sealed-value and blob checks run after the migration", old, want)
			if !strings.Contains(info, pending) || !strings.Contains(info, fmt.Sprintf("database schema version %d (this binary: %d)", old, want)) {
				t.Fatalf("schema %d: the pending migration is not reported:\n%s", old, info)
			}
			if strings.Contains(info, "sealed value(s)") {
				t.Fatalf("the sealed-value check ran on an un-migrated database:\n%s", info)
			}
		}
	}

	// the node migrates it, and the checks run from then on
	a, err := newApp(t, cfg)
	if err != nil {
		t.Fatalf("a node on the older database: %v", err)
	}
	a.Close()
	rep, err := app.Validate(ctx, cfg, true)
	if err != nil || len(rep.Problems) != 0 {
		t.Fatalf("%v %v", rep.Problems, err)
	}
	info := strings.Join(rep.Info, "\n")
	if strings.Contains(info, "migration pending") || !strings.Contains(info, "the master key opens all") || !strings.Contains(info, "referenced blob(s) exist") {
		t.Fatalf("after the migration validate checks everything:\n%s", info)
	}

	// a database from a newer binary is refused
	db, err := sql.Open("sqlite", "file:"+filepath.Join(dir, "meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(fmt.Sprintf("PRAGMA user_version = %d", want+1)); err != nil {
		t.Fatal(err)
	}
	db.Close()
	rep, err = app.Validate(ctx, cfg, false)
	if err != nil || len(rep.Problems) != 1 || !strings.Contains(rep.Problems[0], fmt.Sprintf("schema version %d but this binary supports up to %d", want+1, want)) {
		t.Fatalf("a newer database must be refused: %v %v", rep.Problems, err)
	}
}

// What `run` loads before it listens, validate loads too (spec §2.1): a listener
// certificate that is missing, or a CA bundle with no certificate in it, is a problem
// found at validate time, not at the first start.
func TestValidateLoadsTheTLSAndCAFiles(t *testing.T) {
	dir := t.TempDir()
	cfg := cfgFor(dir, key32())
	if rep, err := app.Validate(context.Background(), cfg, false); err != nil || len(rep.Problems) != 0 {
		t.Fatalf("%v %v", rep.Problems, err)
	}
	empty := filepath.Join(dir, "empty.pem")
	if err := os.WriteFile(empty, []byte("not a certificate\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg.TLSCertFile, cfg.TLSKeyFile = filepath.Join(dir, "no.crt"), filepath.Join(dir, "no.key")
	cfg.AdminTLSCertFile, cfg.AdminTLSKeyFile = empty, empty
	cfg.PipelineCAFile = empty
	rep, err := app.Validate(context.Background(), cfg, false)
	if err != nil {
		t.Fatal(err)
	}
	probs := strings.Join(rep.Problems, "\n")
	for _, want := range []string{
		"the public listener (BINVAULT_TLS_CERT_FILE, BINVAULT_TLS_KEY_FILE): the certificate and key do not load",
		"the admin listener (BINVAULT_ADMIN_TLS_CERT_FILE, BINVAULT_ADMIN_TLS_KEY_FILE): the certificate and key do not load",
		"BINVAULT_PIPELINE_CA_FILE " + empty + " holds no certificate",
	} {
		if !strings.Contains(probs, want) {
			t.Errorf("missing %q in:\n%s", want, probs)
		}
	}
	cfg.PipelineCAFile = filepath.Join(dir, "gone.pem")
	rep, _ = app.Validate(context.Background(), cfg, false)
	if !strings.Contains(strings.Join(rep.Problems, "\n"), "BINVAULT_PIPELINE_CA_FILE: open "+cfg.PipelineCAFile) {
		t.Fatalf("a missing CA file must be reported: %v", rep.Problems)
	}
}
