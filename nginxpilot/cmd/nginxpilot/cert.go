package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

const certUsage = `nginxpilot cert — manage TLS certificates via the running daemon

Usage:
  nginxpilot cert list
  nginxpilot cert issue <domain> [<domain>...] [--cert-name NAME] [--staging]
  nginxpilot cert upload <domain> --cert FILE --key FILE
  nginxpilot cert renew [<domain>]
  nginxpilot cert delete <domain>
  nginxpilot cert creds set <provider> [--token T | --file FILE | --access-key K --secret-key S]
  nginxpilot cert creds list
  nginxpilot cert creds rm <provider>

Common flags:
  --config PATH   config file (default /etc/nginxpilot/config.yml)
`

// cmdCert dispatches the `cert` subcommands. They talk to the running daemon's
// admin API (same surface as the curl examples), reusing the status client's
// listen/token resolution.
func cmdCert(args []string) int {
	if len(args) == 0 {
		fmt.Fprint(os.Stderr, certUsage)
		return 2
	}
	action, rest := args[0], args[1:]
	switch action {
	case "list":
		return certListCmd(rest)
	case "issue":
		return certIssueCmd(rest)
	case "upload":
		return certUploadCmd(rest)
	case "renew":
		return certRenewCmd(rest)
	case "delete":
		return certDeleteCmd(rest)
	case "creds":
		return certCredsCmd(rest)
	default:
		fmt.Fprintf(os.Stderr, "unknown cert action %q\n\n%s", action, certUsage)
		return 2
	}
}

func certListCmd(args []string) int {
	cfg, code := certConfig(args)
	if cfg == nil {
		return code
	}
	return certDo(cfg, http.MethodGet, "/certs", nil)
}

func certIssueCmd(args []string) int {
	fs := flag.NewFlagSet("cert issue", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	certName := fs.String("cert-name", "", "cert name (default: first domain, wildcard-stripped)")
	staging := fs.Bool("staging", false, "use the ACME staging endpoint")
	_ = fs.Parse(args)
	domains := fs.Args()
	if len(domains) == 0 {
		fmt.Fprintln(os.Stderr, "at least one domain is required")
		return 2
	}
	cfg, code := loadCertConfig(*configPath)
	if cfg == nil {
		return code
	}
	body, _ := json.Marshal(map[string]any{"domains": domains, "cert_name": *certName, "staging": *staging})
	return certDo(cfg, http.MethodPost, "/certs", body)
}

func certUploadCmd(args []string) int {
	fs := flag.NewFlagSet("cert upload", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	certFile := fs.String("cert", "", "PEM cert file (leaf + chain)")
	keyFile := fs.String("key", "", "PEM private key file")
	_ = fs.Parse(args)
	rest := fs.Args()
	if len(rest) != 1 || *certFile == "" || *keyFile == "" {
		fmt.Fprintln(os.Stderr, "usage: cert upload <domain> --cert FILE --key FILE")
		return 2
	}
	certPEM, err := os.ReadFile(*certFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read cert: %v\n", err)
		return 1
	}
	keyPEM, err := os.ReadFile(*keyFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read key: %v\n", err)
		return 1
	}
	cfg, code := loadCertConfig(*configPath)
	if cfg == nil {
		return code
	}
	body, _ := json.Marshal(map[string]any{"cert": string(certPEM), "key": string(keyPEM)})
	return certDo(cfg, http.MethodPut, "/certs/"+rest[0], body)
}

func certRenewCmd(args []string) int {
	fs := flag.NewFlagSet("cert renew", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)
	cfg, code := loadCertConfig(*configPath)
	if cfg == nil {
		return code
	}
	if rest := fs.Args(); len(rest) == 1 {
		return certDo(cfg, http.MethodPost, "/certs/"+rest[0]+"/renew", nil)
	}
	return certDo(cfg, http.MethodPost, "/certs/renew", nil)
}

func certDeleteCmd(args []string) int {
	fs := flag.NewFlagSet("cert delete", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)
	rest := fs.Args()
	if len(rest) != 1 {
		fmt.Fprintln(os.Stderr, "usage: cert delete <domain>")
		return 2
	}
	cfg, code := loadCertConfig(*configPath)
	if cfg == nil {
		return code
	}
	return certDo(cfg, http.MethodDelete, "/certs/"+rest[0], nil)
}

func certCredsCmd(args []string) int {
	if len(args) == 0 {
		fmt.Fprint(os.Stderr, certUsage)
		return 2
	}
	action, rest := args[0], args[1:]
	switch action {
	case "list":
		cfg, code := certConfig(rest)
		if cfg == nil {
			return code
		}
		return certDo(cfg, http.MethodGet, "/acme/credentials", nil)
	case "set":
		return certCredsSetCmd(rest)
	case "rm", "delete":
		fs := flag.NewFlagSet("cert creds rm", flag.ExitOnError)
		configPath := fs.String("config", config.DefaultPath, "config file path")
		_ = fs.Parse(rest)
		pos := fs.Args()
		if len(pos) != 1 {
			fmt.Fprintln(os.Stderr, "usage: cert creds rm <provider>")
			return 2
		}
		cfg, code := loadCertConfig(*configPath)
		if cfg == nil {
			return code
		}
		return certDo(cfg, http.MethodDelete, "/acme/credentials/"+pos[0], nil)
	default:
		fmt.Fprintf(os.Stderr, "unknown creds action %q\n\n%s", action, certUsage)
		return 2
	}
}

func certCredsSetCmd(args []string) int {
	fs := flag.NewFlagSet("cert creds set", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	token := fs.String("token", "", "single-token providers (digitalocean, cloudflare, linode)")
	file := fs.String("file", "", "raw credentials body file (any provider)")
	accessKey := fs.String("access-key", "", "route53 access key")
	secretKey := fs.String("secret-key", "", "route53 secret key")
	saJSON := fs.String("service-account-json", "", "google service-account JSON file")
	_ = fs.Parse(args)
	pos := fs.Args()
	if len(pos) != 1 {
		fmt.Fprintln(os.Stderr, "usage: cert creds set <provider> [--token T | --file FILE | --access-key K --secret-key S | --service-account-json FILE]")
		return 2
	}
	req := map[string]any{}
	if *token != "" {
		req["token"] = *token
	}
	if *accessKey != "" {
		req["access_key"] = *accessKey
	}
	if *secretKey != "" {
		req["secret_key"] = *secretKey
	}
	if *file != "" {
		raw, err := os.ReadFile(*file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "read credentials file: %v\n", err)
			return 1
		}
		req["credentials"] = string(raw)
	}
	if *saJSON != "" {
		raw, err := os.ReadFile(*saJSON)
		if err != nil {
			fmt.Fprintf(os.Stderr, "read service-account file: %v\n", err)
			return 1
		}
		req["service_account_json"] = string(raw)
	}
	cfg, code := loadCertConfig(*configPath)
	if cfg == nil {
		return code
	}
	body, _ := json.Marshal(req)
	return certDo(cfg, http.MethodPut, "/acme/credentials/"+pos[0], body)
}

// certConfig parses a flag set carrying only --config and loads it.
func certConfig(args []string) (*config.Config, int) {
	fs := flag.NewFlagSet("cert", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)
	return loadCertConfig(*configPath)
}

func loadCertConfig(configPath string) (*config.Config, int) {
	res, err := config.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return nil, 1
	}
	listen := res.Config.Admin.ListenAddr()
	if listen == "" {
		fmt.Fprintln(os.Stderr, "admin endpoint is disabled (admin.listen is empty)")
		return nil, 1
	}
	return res.Config, 0
}

// certDo issues an admin-API request and prints the response body.
func certDo(cfg *config.Config, method, path string, body []byte) int {
	listen := normalizeListenAddr(cfg.Admin.ListenAddr())
	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, "http://"+listen+path, rdr)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token := clientAdminToken(cfg.Admin); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot reach the daemon at %s: %v (is it running?)\n", listen, err)
		return 1
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	trimmed := strings.TrimRight(string(out), "\n")
	if trimmed != "" {
		fmt.Println(trimmed)
	}
	if resp.StatusCode >= 300 {
		fmt.Fprintf(os.Stderr, "daemon returned %s\n", resp.Status)
		return 1
	}
	return 0
}
