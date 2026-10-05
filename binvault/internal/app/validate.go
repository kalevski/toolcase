package app

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

// Report is the outcome of Validate.
type Report struct {
	Info     []string
	Problems []string
}

// Validate implements `binvault validate` (spec §2.1). It changes nothing: the
// database is opened read-only-ish (no writes beyond what opening needs, no
// migrations applied), nothing is created.
func Validate(ctx context.Context, cfg *config.Config, deep bool) (*Report, error) {
	r := &Report{}
	ok := func(f string, a ...any) { r.Info = append(r.Info, fmt.Sprintf(f, a...)) }
	bad := func(f string, a ...any) { r.Problems = append(r.Problems, fmt.Sprintf(f, a...)) }

	ok("configuration parsed")
	validateFiles(cfg, ok, bad)
	if cfg.ClusterEnabled() {
		validateCluster(cfg, ok, bad)
	}
	ring, err := seal.New(cfg.MasterKey, cfg.MasterKeyOld...)
	if err != nil {
		bad("master key: %v", err)
		return r, nil
	}
	ok("master key id %s (%d key(s) loaded)", ring.CurrentID(), len(ring.IDs()))

	if st, err := os.Stat(cfg.DataDir); err != nil || !st.IsDir() {
		bad("data dir %s does not exist or is not a directory", cfg.DataDir)
		return r, nil
	}
	s, err := store.Inspect(cfg.DataDir)
	if err != nil {
		bad("data dir: %v", err)
		return r, nil
	}
	if err := s.CheckWritable(); err != nil {
		bad("data dir is not writable: %v", err)
	} else {
		ok("data dir %s is writable", cfg.DataDir)
	}
	if err := s.CheckSameFilesystem(); err != nil {
		bad("%v", err)
	} else {
		ok("the data dir, tmp/, uploads/ and blobs/ share one filesystem")
	}
	if free, err := s.FreeBytes(); err == nil {
		if int64(free) < cfg.MinFreeBytes() {
			bad("free space %d MiB is below BINVAULT_MIN_FREE_MB (%d)", free>>20, cfg.MinFreeMB)
		} else {
			ok("free space %d MiB", free>>20)
		}
	}

	if _, err := os.Stat(s.MetaPath()); errors.Is(err, os.ErrNotExist) {
		ok("no database yet (a fresh data dir)")
		return r, nil
	}
	db, err := meta.OpenReadOnly(ctx, s.MetaPath())
	if err != nil {
		bad("metadata database: %v", err)
		return r, nil
	}
	defer db.Close()
	v, err := db.Version(ctx)
	if err != nil {
		bad("metadata database: %v", err)
		return r, nil
	}
	switch want := meta.SchemaVersion(); {
	case v > want:
		bad("the database has schema version %d but this binary supports up to %d", v, want)
		return r, nil // written by a newer binary: this one's queries cannot vouch for it
	case v == 0:
		ok("no database yet (an empty meta.db)")
		return r, nil
	case v < want:
		// The sealed-value and blob checks read the database with the newest schema's
		// queries, which an un-migrated database does not have (`validate` migrates
		// nothing): they run once `run` has migrated it. The packaged unit runs
		// `validate` before `run`, so this must not fail an upgrade (spec §9.6).
		ok("database schema version %d (this binary: %d)", v, want)
		ok("migration pending (%d to %d): the sealed-value and blob checks run after the migration", v, want)
		return r, nil
	}
	ok("database schema version %d (this binary: %d)", v, meta.SchemaVersion())
	problems, n, err := CheckSealed(ctx, db, ring)
	if err != nil {
		return r, err
	}
	for _, p := range problems {
		bad("cannot open sealed value: %s", p)
	}
	if len(problems) == 0 {
		ok("the master key opens all %d sealed value(s)", n)
	}
	if deep {
		missing, checked, err := missingBlobs(ctx, db, s)
		if err != nil {
			return r, err
		}
		for _, m := range missing {
			bad("referenced blob missing: %s", m)
		}
		if len(missing) == 0 {
			ok("all %d referenced blob(s) exist", checked)
		}
	}
	return r, nil
}

// validateFiles loads the files `run` loads before it listens and fails on: the
// certificate and key of the public and admin listeners and the pipeline CA
// bundle (spec §2.1). Whether they exist was never checked when the configuration
// was parsed.
func validateFiles(cfg *config.Config, ok, bad func(string, ...any)) {
	for _, l := range []struct{ what, cert, key string }{
		{"the public listener (BINVAULT_TLS_CERT_FILE, BINVAULT_TLS_KEY_FILE)", cfg.TLSCertFile, cfg.TLSKeyFile},
		{"the admin listener (BINVAULT_ADMIN_TLS_CERT_FILE, BINVAULT_ADMIN_TLS_KEY_FILE)", cfg.AdminTLSCertFile, cfg.AdminTLSKeyFile},
	} {
		if l.cert == "" && l.key == "" {
			continue
		}
		if _, err := tls.LoadX509KeyPair(l.cert, l.key); err != nil {
			bad("%s: the certificate and key do not load: %v", l.what, err)
		} else {
			ok("%s: the certificate and key load", l.what)
		}
	}
	if cfg.PipelineCAFile != "" {
		pem, err := os.ReadFile(cfg.PipelineCAFile)
		switch {
		case err != nil:
			bad("BINVAULT_PIPELINE_CA_FILE: %v", err)
		case !x509.NewCertPool().AppendCertsFromPEM(pem):
			bad("BINVAULT_PIPELINE_CA_FILE %s holds no certificate", cfg.PipelineCAFile)
		default:
			ok("the pipeline CA file holds certificates")
		}
	}
}

// validateCluster checks the cluster settings (spec §2.1, §8.3) without
// contacting a peer: the syntax of every variable was checked when the
// configuration was parsed, so what is left is what only the file system can say —
// that the peer listener's certificate and key load and that the CA file holds
// certificates — and a summary of what this node would join.
func validateCluster(cfg *config.Config, ok, bad func(string, ...any)) {
	ok("cluster mode: node %q, %d peer URL(s), peer listener %s", cfg.NodeName, len(cfg.ClusterURLs), cfg.ClusterListen)
	if !cluster.ValidNodeName(cfg.NodeName) {
		bad("BINVAULT_NODE_NAME %q is not a valid node name", cfg.NodeName)
	}
	for i, k := range cfg.ClusterKey {
		if len(k) < 32 {
			bad("cluster key %d is %d bytes: at least 32 are required", i+1, len(k))
		}
	}
	if len(cfg.ClusterKey) == 0 {
		bad("BINVAULT_CLUSTER_KEY is required in a cluster")
	} else {
		ok("%d cluster key(s) accepted; the first is sent", len(cfg.ClusterKey))
	}
	if cfg.ClusterTLSEnabled() {
		if _, err := tls.LoadX509KeyPair(cfg.ClusterTLSCertFile, cfg.ClusterTLSKeyFile); err != nil {
			bad("the peer listener's certificate and key do not load: %v", err)
		} else {
			ok("the peer listener's certificate and key load")
		}
	} else if cfg.ClusterInsecureHTTP {
		ok("the peer listener serves plain HTTP (BINVAULT_CLUSTER_INSECURE_HTTP): use it on a private network or VPN only")
	}
	if cfg.ClusterCAFile != "" {
		pem, err := os.ReadFile(cfg.ClusterCAFile)
		switch {
		case err != nil:
			bad("BINVAULT_CLUSTER_CA_FILE: %v", err)
		case !x509.NewCertPool().AppendCertsFromPEM(pem):
			bad("BINVAULT_CLUSTER_CA_FILE %s holds no certificate", cfg.ClusterCAFile)
		default:
			ok("the cluster CA file holds certificates")
		}
	}
	for _, u := range cfg.ClusterURLs {
		if strings.HasPrefix(u, "http://") && !cfg.ClusterInsecureHTTP {
			bad("peer URL %s is plain HTTP: use https://, or set BINVAULT_CLUSTER_INSECURE_HTTP=true on a private network or VPN", u)
		}
	}
}

// RekeyDataDir implements `binvault rekey` on a stopped node. It takes the data
// dir's lock like a node does (spec §3.1): re-sealing under a key that a running
// node does not know would make every token it has not cached fail until the next
// restart, so it refuses while another process holds the directory.
func RekeyDataDir(ctx context.Context, cfg *config.Config) (int, error) {
	s, err := store.Inspect(cfg.DataDir)
	if err != nil {
		return 0, err
	}
	if err := s.Lock(); err != nil {
		return 0, err
	}
	defer s.Close() // after the database, which is closed first
	db, err := meta.Open(ctx, s.MetaPath(), meta.Options{})
	if err != nil {
		return 0, err
	}
	defer db.Close()
	ring, err := seal.New(cfg.MasterKey, cfg.MasterKeyOld...)
	if err != nil {
		return 0, err
	}
	return Rekey(ctx, db, ring)
}

// missingBlobs lists referenced blobs whose file is gone (`validate --deep`), each
// with the objects that need it (bucket, key and version), so that the damage can be
// restored or cleaned up by name.
func missingBlobs(ctx context.Context, db *meta.DB, st *store.Store) (missing []string, checked int, err error) {
	after := ""
	for {
		bs, err := db.Read().ListBlobs(ctx, after, 1000)
		if err != nil {
			return nil, 0, err
		}
		for _, b := range bs {
			after = b.BlobID
			if b.Refs <= 0 {
				continue // pending GC: the file may legitimately be gone
			}
			checked++
			if _, err := st.Size(b.BlobID); err != nil && len(missing) < 100 {
				missing = append(missing, describeBlob(ctx, db, b))
			}
		}
		if len(bs) < 1000 {
			return missing, checked, nil
		}
	}
}

// describeBlob names a blob and, up to three, the version rows that reference it.
func describeBlob(ctx context.Context, db *meta.DB, b *meta.Blob) string {
	objs, err := db.Read().ObjectsOfBlob(ctx, b.BlobID, 4)
	if err != nil || len(objs) == 0 {
		return fmt.Sprintf("%s (bucket %s)", b.BlobID, b.Bucket)
	}
	var users []string
	for i, o := range objs {
		if i == 3 {
			users = append(users, "...")
			break
		}
		users = append(users, fmt.Sprintf("bucket %s, key %q, version %s", o.Bucket, o.Key, o.Version))
	}
	return fmt.Sprintf("%s (%s)", b.BlobID, strings.Join(users, "; "))
}
