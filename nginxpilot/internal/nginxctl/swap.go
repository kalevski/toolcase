package nginxctl

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// stage (re)creates fresh staging dirs and writes the base http includes plus
// the given resources into the right context dir.
func (e *Engine) stage(httpStaging, streamStaging string, baseHTTP, resources []rendered) error {
	if err := freshDir(httpStaging); err != nil {
		return err
	}
	if err := freshDir(streamStaging); err != nil {
		return err
	}
	for _, r := range baseHTTP {
		if err := writeStagedFile(httpStaging, r.filename, r.content); err != nil {
			return err
		}
	}
	for _, r := range resources {
		dir := httpStaging
		if r.context == ctxStream {
			dir = streamStaging
		}
		if err := writeStagedFile(dir, r.filename, r.content); err != nil {
			return err
		}
	}
	return nil
}

// swapAndReload atomically replaces the live dirs with the staged ones, runs the
// configured `nginx -t` against the real merged config as a final gate, then
// reloads. Any failure after the swap rolls both dirs back to the previous
// snapshot so nginx keeps serving the last-good config.
func (e *Engine) swapAndReload(ctx context.Context, httpStaging, streamStaging string) error {
	if err := e.swap(httpStaging, e.confDir); err != nil {
		return err
	}
	if err := e.swap(streamStaging, e.streamDir); err != nil {
		_ = e.rollback(e.confDir)
		return err
	}

	if out, err := e.runConfigured(ctx, e.testCmd); err != nil {
		e.log.Error("live nginx -t failed after swap; rolling back", "output", oneLine(out))
		_ = e.rollback(e.confDir)
		_ = e.rollback(e.streamDir)
		return fmt.Errorf("live nginx -t failed: %w", err)
	}

	if out, err := e.runConfigured(ctx, e.reloadCmd); err != nil {
		e.log.Error("nginx reload failed after passing -t; rolling back", "output", oneLine(out))
		_ = e.rollback(e.confDir)
		_ = e.rollback(e.streamDir)
		_, _ = e.runConfigured(ctx, e.reloadCmd) // best effort to restore the last-good
		return fmt.Errorf("nginx reload failed: %w", err)
	}

	e.cleanupBak(e.confDir)
	e.cleanupBak(e.streamDir)
	return nil
}

func (e *Engine) runConfigured(ctx context.Context, cmd []string) (string, error) {
	if len(cmd) == 0 {
		return "", nil
	}
	return e.run(ctx, cmd[0], cmd[1:]...)
}

// swap moves staging into place as live, keeping the previous live dir as
// <live>.bak so a failed reload can roll back. rename(2) within the same parent
// is atomic; the brief live→bak then staging→live window is acceptable.
func (e *Engine) swap(staging, live string) error {
	if err := ensureDir(filepath.Dir(live)); err != nil {
		return err
	}
	bak := live + ".bak"
	_ = os.RemoveAll(bak)
	if _, err := os.Stat(live); err == nil {
		if err := os.Rename(live, bak); err != nil {
			return fmt.Errorf("snapshot live dir: %w", err)
		}
	}
	if err := os.Rename(staging, live); err != nil {
		// restore the snapshot on a failed swap
		if _, statErr := os.Stat(bak); statErr == nil {
			_ = os.Rename(bak, live)
		}
		return fmt.Errorf("swap staging into place: %w", err)
	}
	syncDir(filepath.Dir(live))
	return nil
}

// rollback restores <live>.bak over live (used when a post-swap step fails).
func (e *Engine) rollback(live string) error {
	bak := live + ".bak"
	if _, err := os.Stat(bak); err != nil {
		return nil // nothing to roll back to
	}
	_ = os.RemoveAll(live)
	return os.Rename(bak, live)
}

func (e *Engine) cleanupBak(live string) {
	_ = os.RemoveAll(live + ".bak")
}

func freshDir(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	return os.MkdirAll(dir, 0o750)
}

func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0o750)
}

// writeStagedFile writes one config file group-readable (nginx reads via group).
func writeStagedFile(dir, name, content string) error {
	if err := ensureDir(dir); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, name), []byte(content), 0o640)
}

func removeStagedFile(dir, name string) error {
	return os.Remove(filepath.Join(dir, name))
}

func syncDir(path string) {
	if d, err := os.Open(path); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
}
