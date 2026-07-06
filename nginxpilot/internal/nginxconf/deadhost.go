package nginxconf

import (
	"fmt"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// DeadHostVhost renders a parked (404/dead) host: a server{} block answering
// every request with a fixed error code. code 444 closes the connection with
// zero response bytes. Unlike redirects, force_ssl IS allowed — an https-only
// parked domain that 301s plain HTTP up first is legitimate.
func DeadHostVhost(cfg *config.Config, d *config.DeadHost, opts Options) (string, error) {
	return renderSimpleVhost(cfg, "dead host", d.Domain, d.ListenPort(), d.WebOptions, d.AccessList, opts, func(b *strings.Builder) {
		fmt.Fprintf(b, "\n    return %d;\n", d.CodeOrDefault())
	})
}
