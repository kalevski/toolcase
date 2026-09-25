package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"text/tabwriter"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/admin"
	"github.com/kalevski/toolcase/zonewright/internal/cluster"
	"github.com/kalevski/toolcase/zonewright/internal/config"
)

// cmdStatus renders a table from the daemon's /status endpoint; --json passes
// the raw payload through.
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

	scheme := "http"
	client := &http.Client{Timeout: 10 * time.Second}
	if res.Config.Admin.TLS.Enabled() {
		// Talking to our own loopback listener: the certificate is issued
		// for the public name, not 127.0.0.1, so verification is skipped.
		scheme = "https"
		client.Transport = &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}
	}
	token := clientAdminToken(res.Config.Admin)
	fetch := func(path string) ([]byte, int, error) {
		req, err := http.NewRequest(http.MethodGet, scheme+"://"+listen+path, nil)
		if err != nil {
			return nil, 0, err
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := client.Do(req)
		if err != nil {
			return nil, 0, err
		}
		defer resp.Body.Close()
		b, err := io.ReadAll(resp.Body)
		return b, resp.StatusCode, err
	}
	body, code, err := fetch("/status")
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot reach the daemon at %s: %v (is it running?)\n", listen, err)
		return 1
	}
	if code != http.StatusOK {
		fmt.Fprintf(os.Stderr, "daemon returned %d: %s\n", code, body)
		return 1
	}
	clusterBody, clusterCode, _ := fetch("/cluster/status")
	if *asJSON {
		fmt.Println(string(body))
		if clusterCode == http.StatusOK {
			fmt.Println(string(clusterBody))
		}
		return 0
	}

	var st admin.Status
	if err := json.Unmarshal(body, &st); err != nil {
		fmt.Fprintf(os.Stderr, "bad /status payload: %v\n", err)
		return 1
	}
	fmt.Printf("node %s\n\n", st.NodeID)
	w := tabwriter.NewWriter(os.Stdout, 2, 4, 2, ' ', 0)
	fmt.Fprintln(w, "ZONE\tSOURCE\tSTATE\tSERIAL\tRECORDS\tREASON")
	for _, z := range st.Zones {
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%d\t%s\n", z.Zone, z.Source, z.State, z.Serial, z.Records, orDash(truncate(z.Reason, 80)))
	}
	_ = w.Flush()
	for _, c := range st.Conflicts {
		fmt.Printf("CONFLICT %s (%s): %s\n", c.Zone, c.Kind, c.Detail)
	}
	if clusterCode == http.StatusOK {
		var cs cluster.Status
		if err := json.Unmarshal(clusterBody, &cs); err == nil {
			fmt.Printf("\ncluster: ready=%v, %d op(s) in log, %d held\n", cs.Ready, cs.Log.Ops, cs.HeldOps)
			cw := tabwriter.NewWriter(os.Stdout, 2, 4, 2, ' ', 0)
			fmt.Fprintln(cw, "URL\tNODE\tROLE\tLAG\tLAST PULL\tSKEW\tPROBLEM")
			for _, u := range cs.URLs {
				role := "peer"
				if u.Self {
					role = "self"
				}
				last := "-"
				if !u.LastPull.IsZero() {
					last = u.LastPull.Local().Format("15:04:05")
				}
				fmt.Fprintf(cw, "%s\t%s\t%s\t%d\t%s\t%s\t%s\n", u.URL, orDash(shortID(u.NodeID)), role, u.Lag, last, orDash(u.ClockSkew), orDash(truncate(u.Alarm+u.Error, 70)))
			}
			_ = cw.Flush()
		}
	}
	if st.LastApply != nil {
		fmt.Printf("\nlast apply %s, reloaded=%v", st.LastApply.At.Local().Format("2006-01-02 15:04:05"), st.LastApply.Reloaded)
		if st.PendingReload {
			fmt.Printf(", reload pending: %s", st.LastApply.ReloadError)
		}
		fmt.Println()
	}
	return 0
}

// clientAdminToken resolves the bearer token the status client presents,
// matching the daemon's resolution. On failure it warns and returns "" so the
// daemon's 401 surfaces a clear message.
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

func normalizeListenAddr(listen string) string {
	host, port, err := net.SplitHostPort(listen)
	if err == nil && (host == "" || host == "0.0.0.0" || host == "::") {
		listen = net.JoinHostPort("127.0.0.1", port)
	}
	return listen
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

func shortID(id string) string {
	if len(id) > 12 {
		return id[:12] + "…"
	}
	return id
}
