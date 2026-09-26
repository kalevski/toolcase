package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"text/tabwriter"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
)

// cmdStatus renders a human table from the daemon's /status endpoint;
// --json passes the raw payload through (spec §6).
func cmdStatus(args []string) int {
	fs := flag.NewFlagSet("status", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	asJSON := fs.Bool("json", false, "print the raw /status JSON")
	_ = fs.Parse(args)

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	resp, err := adminDo(res.Config.Admin, http.MethodGet, "/status", nil, "", 10*time.Second)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "daemon returned %s: %s\n", resp.Status, body)
		return 1
	}

	if *asJSON {
		fmt.Println(string(body))
		return 0
	}

	var payload struct {
		Sites []manager.SiteStatus `json:"sites"`
		Nginx *struct {
			Managed       bool                      `json:"managed"`
			Resources     []nginxctl.ResourceResult `json:"resources"`
			DisabledCount int                       `json:"disabled_count"`
			AtRiskCount   int                       `json:"at_risk_count"`
			Reconcile     *manager.ReconcileSummary `json:"reconcile"`
		} `json:"nginx"`
		CertsRenewal *struct {
			Enabled       bool       `json:"enabled"`
			CheckInterval string     `json:"check_interval"`
			RenewBefore   string     `json:"renew_before"`
			NextCheck     *time.Time `json:"next_check"`
		} `json:"certs_renewal"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		fmt.Fprintf(os.Stderr, "bad /status payload: %v\n", err)
		return 1
	}

	w := tabwriter.NewWriter(os.Stdout, 2, 4, 2, ' ', 0)
	fmt.Fprintln(w, "DOMAIN\tTYPE\tREF\tLAST SUCCESS\tSTREAK\tNEXT SYNC\tERROR")
	for _, s := range payload.Sites {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%d\t%s\t%s\n",
			s.Domain, s.SourceType, orDash(s.DeployedRef),
			fmtTime(s.LastSuccess), s.FailureStreak, fmtTime(s.NextSync),
			orDash(truncate(s.LastError, 60)))
	}
	_ = w.Flush()

	// Managed-mode resource table: only non-active resources are itemized —
	// the summary line carries the healthy count.
	if payload.Nginx != nil && payload.Nginx.Managed {
		n := payload.Nginx
		fmt.Printf("\nnginx: %d resource(s), %d disabled, %d at risk",
			len(n.Resources), n.DisabledCount, n.AtRiskCount)
		if n.Reconcile != nil && n.Reconcile.Enabled {
			fmt.Printf(" (reconcile every %s, on_failure=%s)", n.Reconcile.IntervalStr, n.Reconcile.OnFailure)
		}
		fmt.Println()
		if n.DisabledCount+n.AtRiskCount > 0 {
			rw := tabwriter.NewWriter(os.Stdout, 2, 4, 2, ' ', 0)
			fmt.Fprintln(rw, "KIND\tKEY\tSTATE\tSINCE\tREASON")
			for _, r := range n.Resources {
				if r.State == "active" {
					continue
				}
				fmt.Fprintf(rw, "%s\t%s\t%s\t%s\t%s\n",
					r.Kind, r.Key, r.State, fmtTime(r.Since), orDash(truncate(r.Reason, 80)))
			}
			_ = rw.Flush()
		}
	}

	if cr := payload.CertsRenewal; cr != nil && cr.Enabled {
		fmt.Printf("\ncert renewal: every %s, renew when < %s to expiry, next check %s\n",
			cr.CheckInterval, cr.RenewBefore, fmtTime(cr.NextCheck))
	}
	return 0
}

func fmtTime(t *time.Time) string {
	if t == nil || t.IsZero() {
		return "-"
	}
	return t.Local().Format("2006-01-02 15:04:05")
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
