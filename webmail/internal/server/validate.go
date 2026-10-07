package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/config"
	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/store"
)

// Report is the outcome of Validate.
type Report struct {
	Info     []string
	Problems []string
}

// Validate checks the data dir, the database, and that the JMAP server answers.
// It changes nothing but a temporary probe file.
func Validate(ctx context.Context, cfg *config.Config) (*Report, error) {
	rep := &Report{}
	rep.Info = append(rep.Info, fmt.Sprintf("configuration valid (session key %d bytes, API token %d characters)", len(cfg.SessionKey), len(cfg.APIToken)))

	probe := filepath.Join(cfg.DataDir, ".validate-probe")
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		rep.Problems = append(rep.Problems, "data dir: "+err.Error())
	} else if err := os.WriteFile(probe, []byte("x"), 0o600); err != nil {
		rep.Problems = append(rep.Problems, "data dir not writable: "+err.Error())
	} else {
		os.Remove(probe)
		rep.Info = append(rep.Info, "data dir writable: "+cfg.DataDir)
		st, err := store.Open(ctx, cfg.DataDir, store.Options{})
		if err != nil {
			rep.Problems = append(rep.Problems, "database: "+err.Error())
		} else {
			v, _ := st.Version(ctx)
			n, _ := st.CountBrandings(ctx)
			rep.Info = append(rep.Info, fmt.Sprintf("database ok (schema %d, %d registered domains)", v, n))
			st.Close()
		}
	}

	// JMAP: any HTTP answer to the unauthenticated session resource (usually
	// 401) proves the server is reachable.
	cctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(cctx, http.MethodGet, cfg.JMAPURL+jmap.SessionPath, nil)
	if resp, err := (&http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}).Do(req); err != nil {
		rep.Problems = append(rep.Problems, "JMAP server unreachable: "+err.Error())
	} else {
		resp.Body.Close()
		rep.Info = append(rep.Info, fmt.Sprintf("JMAP server reachable (%s -> %d)", jmap.SessionPath, resp.StatusCode))
	}

	return rep, nil
}
