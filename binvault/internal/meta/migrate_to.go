package meta

import (
	"context"
	"database/sql"
	"fmt"
)

// MigrateTo creates the database at path with only the first v migrations
// applied: the state a binary of an older release leaves behind. It exists so
// tests can ask what a newer binary does with such a database before it has
// migrated it (`binvault validate` ahead of an upgrade, spec §9.6); nothing else
// calls it.
func MigrateTo(ctx context.Context, path string, v int) error {
	if v < 0 || v > len(migrations) {
		return fmt.Errorf("meta: no schema version %d (this binary knows 0 to %d)", v, len(migrations))
	}
	db, err := sql.Open("sqlite", "file:"+escapePath(path)+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)")
	if err != nil {
		return err
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	for i := 0; i < v; i++ {
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, migrations[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("meta: migration %d: %w", i+1, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`PRAGMA user_version = %d`, i+1)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
