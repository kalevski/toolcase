package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
)

// cmdPrintLogFormat prints the JSON access-log log_format declaration for
// generate-only setups: paste it at http context, then uncomment the
// access_log lines print-vhost emits. Managed mode writes the include itself.
func cmdPrintLogFormat(args []string) int {
	fs := flag.NewFlagSet("print-logformat", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)

	cfg := &config.Config{}
	cfg.Logs.Access.Enabled = true // render even when the config disables it
	if res, err := config.Load(*configPath); err == nil {
		cfg.Logs = res.Config.Logs
		cfg.Logs.Access.Enabled = true
	} else {
		fmt.Fprintf(os.Stderr, "warning: %v; printing defaults\n", err)
	}

	fmt.Printf(`# nginxpilot JSON access-log format — add inside the http { } block
# (e.g. /etc/nginx/conf.d/00-nginxpilot-logformat.conf), then point vhosts at it:
#   access_log syslog:server=%s,tag=nginxpilot %s;

%s`, cfg.Logs.Access.ListenOrDefault(), nginxconf.LogFormatName, nginxconf.LogFormatInclude(cfg))
	return 0
}
