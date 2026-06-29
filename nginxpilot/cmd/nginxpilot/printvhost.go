package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
)

// cmdPrintVhost prints a correct, commented nginx snippet for one domain
// (Model A helper, spec §5): a content-serving server{} block for a static
// site, or upstream{} + proxy_pass server{} blocks for a reverse proxy. The
// daemon never touches nginx config — paste and adapt this.
func cmdPrintVhost(args []string) int {
	fs := flag.NewFlagSet("print-vhost", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	domain, ok := parseWithPositional(fs, args, "usage: nginxpilot print-vhost <domain> [flags]")
	if !ok {
		return 2
	}

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}

	// If a cert dir is configured and present, render real cert paths; otherwise
	// the snippet falls back to conventional certbot paths.
	var opts nginxconf.Options
	if dir, derr := res.Config.Tls.ResolveDir(); derr == nil && dir != "" {
		if idx, lerr := certs.Load(dir); lerr == nil {
			opts.Certs = idx
		}
	}

	out, err := nginxconf.VhostOpts(res.Config, domain, opts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		return 1
	}
	fmt.Print(out)
	return 0
}
