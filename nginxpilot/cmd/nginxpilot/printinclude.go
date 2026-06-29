package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// cmdPrintInclude prints the nginx.conf snippet that wires nginxpilot's managed
// directories into nginx — the http-context include for conf_dir and the
// top-level stream{} block for stream_conf_dir. Run once during first-time
// managed-mode setup; the Docker image bakes these in.
func cmdPrintInclude(args []string) int {
	fs := flag.NewFlagSet("print-include", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)

	confDir, streamDir := config.DefaultConfDir, config.DefaultStreamConfDir
	if res, err := config.Load(*configPath); err == nil {
		if res.Config.Nginx.ConfDir != "" {
			confDir = res.Config.Nginx.ConfDir
		}
		if res.Config.Nginx.StreamConfDir != "" {
			streamDir = res.Config.Nginx.StreamConfDir
		}
	} else {
		fmt.Fprintf(os.Stderr, "warning: %v; printing defaults\n", err)
	}

	fmt.Printf(`# nginxpilot managed-mode includes — add these to /etc/nginx/nginx.conf.

# 1. Inside the existing http { } block (conf.d/*.conf does NOT recurse into
#    subdirectories, so this nested dir needs its own include):
http {
    # ... your existing http config ...
    include %[1]s/*.conf;
}

# 2. As a NEW top-level block (stream{} is a different context than http{}):
stream {
    include %[2]s/*.conf;
}
`, confDir, streamDir)
	return 0
}
