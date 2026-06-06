package httpzip

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// extract unpacks the downloaded archive into stagingDir enforcing the hard
// safety rules from spec §4.2:
//
//   - reject absolute paths and .. traversal (zip-slip)
//   - reject symlinks outright (Q18)
//   - enforce entry-count, uncompressed-size and compression-ratio limits
//   - auto-strip a single shared root directory (Q11), unless
//     strip_components overrides
func (s *Syncer) extract(archivePath string, archiveSize int64, stagingDir string) error {
	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("invalid zip archive: %w", err)
	}
	defer zr.Close()

	if len(zr.File) == 0 {
		return fmt.Errorf("zip archive contains no entries")
	}
	if len(zr.File) > s.limits.MaxEntries {
		return fmt.Errorf("limit exceeded: max_entries (%d > %d)", len(zr.File), s.limits.MaxEntries)
	}

	// Pre-flight: validate every path, reject symlinks, total the declared
	// uncompressed size for the bomb checks before writing anything.
	var declaredTotal uint64
	names := make([]string, 0, len(zr.File))
	for _, f := range zr.File {
		name, err := cleanEntryName(f.Name)
		if err != nil {
			return err
		}
		if f.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("zip entry %q is a symlink: symlinks are rejected (potential read-anything primitive)", f.Name)
		}
		declaredTotal += f.UncompressedSize64
		names = append(names, name)
	}
	maxUncompressed := uint64(s.limits.MaxUncompressedSize)
	if declaredTotal > maxUncompressed {
		return fmt.Errorf("limit exceeded: max_uncompressed_size (%d bytes declared > %s)", declaredTotal, s.limits.MaxUncompressedSize)
	}
	if archiveSize > 0 && declaredTotal/uint64(archiveSize) > uint64(s.limits.MaxCompressionRatio) {
		return fmt.Errorf("limit exceeded: max_compression_ratio (%d:1 > %d:1)", declaredTotal/uint64(archiveSize), s.limits.MaxCompressionRatio)
	}

	strip := s.resolveStrip(names)

	var writtenTotal uint64
	for i, f := range zr.File {
		name := names[i]
		parts := strings.Split(name, "/")
		if len(parts) <= strip {
			// Entry above the strip depth (e.g. the root dir itself).
			if !isDirEntry(f) {
				s.log.Warn("skipping file above strip_components depth", "entry", f.Name)
			}
			continue
		}
		rel := strings.Join(parts[strip:], "/")
		target := filepath.Join(stagingDir, filepath.FromSlash(rel))

		if isDirEntry(f) {
			if err := os.MkdirAll(target, 0o750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
			return err
		}
		n, err := writeEntry(f, target, maxUncompressed-writtenTotal)
		if err != nil {
			return fmt.Errorf("extract %q: %w", f.Name, err)
		}
		writtenTotal += n
		// Belt-and-braces: actual bytes may exceed declared sizes on a
		// crafted archive; enforce the cap on real output too.
		if writtenTotal > maxUncompressed {
			return fmt.Errorf("limit exceeded: max_uncompressed_size (%s)", s.limits.MaxUncompressedSize)
		}
	}
	return nil
}

// resolveStrip returns how many leading path components to drop. Explicit
// strip_components wins (including 0 = force off); otherwise a single
// shared top-level directory is stripped automatically — covers GitHub's
// repo-sha/ layout (spec Q11).
func (s *Syncer) resolveStrip(names []string) int {
	if s.strip != nil {
		return *s.strip
	}
	root := ""
	for _, name := range names {
		if name == "." {
			continue
		}
		first, rest, _ := strings.Cut(name, "/")
		if rest == "" && name == first {
			// A bare top-level file (or the root dir entry "root/" already
			// normalized without slash) — only a dir entry may sit at the
			// root for auto-strip to apply. zip dir entries end with "/",
			// but cleanEntryName trims that, so check via names multiplicity.
			if !sliceHasPrefix(names, first+"/") {
				return 0
			}
			continue
		}
		if root == "" {
			root = first
		} else if first != root {
			return 0
		}
	}
	if root == "" {
		return 0
	}
	s.log.Debug("auto-stripping shared root directory", "root", root)
	return 1
}

func sliceHasPrefix(names []string, prefix string) bool {
	for _, n := range names {
		if strings.HasPrefix(n, prefix) {
			return true
		}
	}
	return false
}

func writeEntry(f *zip.File, target string, budget uint64) (uint64, error) {
	rc, err := f.Open()
	if err != nil {
		return 0, err
	}
	defer rc.Close()
	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
	if err != nil {
		return 0, err
	}
	// +1 so the caller can detect budget overrun.
	n, copyErr := io.Copy(out, io.LimitReader(rc, int64(budget)+1))
	closeErr := out.Close()
	if copyErr != nil {
		return uint64(n), copyErr
	}
	return uint64(n), closeErr
}

func isDirEntry(f *zip.File) bool {
	return strings.HasSuffix(f.Name, "/") || f.Mode().IsDir()
}

// cleanEntryName normalizes and validates one zip entry path (zip-slip).
func cleanEntryName(name string) (string, error) {
	n := strings.ReplaceAll(name, `\`, "/")
	n = strings.TrimSuffix(n, "/")
	n = path.Clean(n)
	if n == "." || n == "" {
		return ".", nil
	}
	if path.IsAbs(n) || n == ".." || strings.HasPrefix(n, "../") || strings.Contains(n, "/../") {
		return "", fmt.Errorf("zip entry %q escapes the staging dir (zip-slip)", name)
	}
	if strings.ContainsRune(n, 0) {
		return "", fmt.Errorf("zip entry %q contains a NUL byte", name)
	}
	return n, nil
}
