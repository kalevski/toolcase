package nginxconf

import (
	"fmt"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// LogFormatIncludeFilename is the managed http-context include declaring the
// JSON access-log format. The 00- prefix keeps it sorted before every vhost
// file in glob-ordered includes — nginx requires log_format to be declared
// before any access_log references it (G5).
const LogFormatIncludeFilename = "00-nginxpilot-logformat.conf"

// LogFormatName is the log_format identifier. Prefix-namespaced so a
// user-declared format can't collide with it; a duplicate declaration is a
// hard nginx -t failure caught by the validate-before-write path (G5).
const LogFormatName = "nginxpilot_json"

// Resource types stamped into $np_resource_type (the join key back to
// nginxpilot's own entity model).
const (
	LogResourceSite     = "site"
	LogResourceProxy    = "proxy"
	LogResourceRedirect = "redirect"
	LogResourceDeadHost = "dead_host"
)

// LogFormatInclude renders the managed log_format include (log_ides.md §1.2).
// Returns "" when access logging is disabled.
//
// escape=json handles quoting; $status and $body_bytes_sent are always numeric
// so they are emitted unquoted → real JSON numbers. $upstream_response_time can
// be a comma-separated list on retries — kept a string, parsed leniently
// downstream. $request_time is numeric ("0.000") and safe unquoted.
func LogFormatInclude(cfg *config.Config) string {
	if !cfg.Logs.Access.Enabled {
		return ""
	}
	var b strings.Builder
	b.WriteString("# nginxpilot managed JSON access-log format — do not edit.\n")
	b.WriteString("log_format " + LogFormatName + " escape=json '{'\n")
	fields := []string{
		`"ts":"$time_iso8601",`,
		`"host":"$host",`,
		`"server_name":"$server_name",`,
		`"remote_addr":"$remote_addr",`,
		`"method":"$request_method",`,
		`"path":"$uri",`,
		`"query":"$args",`,
		`"status":$status,`,
		`"bytes_sent":$body_bytes_sent,`,
		`"request_time":$request_time,`,
		`"upstream_time":"$upstream_response_time",`,
		`"upstream_addr":"$upstream_addr",`,
		`"scheme":"$scheme",`,
		`"protocol":"$server_protocol",`,
		`"referer":"$http_referer",`,
		`"user_agent":"$http_user_agent",`,
		`"resource":"$np_resource",`,
		`"resource_type":"$np_resource_type"`,
	}
	for _, f := range fields {
		b.WriteString("    '" + f + "'\n")
	}
	b.WriteString("'}';\n")
	return b.String()
}

// accessLogDirectives returns the three per-vhost lines: the $np_* join keys
// plus the syslog access_log. resource is the entity's own key (bounded, unlike
// $host under wildcards — G15); it is a validated domain, safe to quote.
func accessLogDirectives(cfg *config.Config, resource, resourceType string) []string {
	return []string{
		fmt.Sprintf("set $np_resource %q;", resource),
		fmt.Sprintf("set $np_resource_type %q;", resourceType),
		fmt.Sprintf("access_log syslog:server=%s,tag=nginxpilot %s;", cfg.Logs.Access.ListenOrDefault(), LogFormatName),
	}
}

// simpleVhostResourceType maps renderSimpleVhost's human kind string onto the
// $np_resource_type token.
func simpleVhostResourceType(kind string) string {
	if kind == "redirect" {
		return LogResourceRedirect
	}
	return LogResourceDeadHost
}

// writeAccessLog emits the JSON access-log directives for one vhost. Managed
// mode writes them live; generate-only mode (print-vhost) emits them as
// comments so unmanaged users can opt in by hand (§1.2) — pairing with the
// log_format include they must add at http context.
func writeAccessLog(b *strings.Builder, cfg *config.Config, opts Options, resource, resourceType string) {
	if !cfg.Logs.Access.Enabled {
		return
	}
	if opts.Managed {
		for _, line := range accessLogDirectives(cfg, resource, resourceType) {
			b.WriteString("    " + line + "\n")
		}
		return
	}
	b.WriteString("\n    # JSON access log (logs.access.enabled) — uncomment after declaring the\n")
	b.WriteString("    # log_format at http context (nginxpilot print-logformat):\n")
	for _, line := range accessLogDirectives(cfg, resource, resourceType) {
		b.WriteString("    # " + line + "\n")
	}
}
