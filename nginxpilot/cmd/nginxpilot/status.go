package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"text/tabwriter"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
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
	listen := res.Config.Admin.ListenAddr()
	if listen == "" {
		fmt.Fprintln(os.Stderr, "admin endpoint is disabled (admin.listen is empty); status unavailable")
		return 1
	}
	listen = normalizeListenAddr(listen)

	req, err := http.NewRequest(http.MethodGet, "http://"+listen+"/status", nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if token := clientAdminToken(res.Config.Admin); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot reach the daemon at %s: %v (is it running?)\n", listen, err)
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
	return 0
}

// clientAdminToken resolves the bearer token the status client should present,
// matching the daemon's own resolution (admin.token_env OR admin.token_file).
// Returns "" when no auth is configured, or when a configured ref can't be
// resolved here — in which case we still issue the request and let the daemon's
// 401 surface a clear message rather than failing silently.
func clientAdminToken(a config.Admin) string {
	if a.TokenEnv == "" && a.TokenFile == "" {
		return ""
	}
	token, err := config.ResolveSecret(a.TokenEnv, a.TokenFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: cannot resolve admin token (%v); requesting without auth\n", err)
		return ""
	}
	return token
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

func normalizeListenAddr(listen string) string {
	host, port, err := net.SplitHostPort(listen)
	if err == nil && (host == "" || host == "0.0.0.0" || host == "::") {
		listen = net.JoinHostPort("127.0.0.1", port)
	}
	return listen
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
