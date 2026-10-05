package config

import (
	"slices"
	"strings"
)

// Variable names, in the order of the spec §2.3 table.
const (
	envAdminToken                   = "BINVAULT_ADMIN_TOKEN"
	envMasterKey                    = "BINVAULT_MASTER_KEY"
	envMasterKeyOld                 = "BINVAULT_MASTER_KEY_OLD"
	envListen                       = "BINVAULT_LISTEN"
	envAdminListen                  = "BINVAULT_ADMIN_LISTEN"
	envAdminTLSCertFile             = "BINVAULT_ADMIN_TLS_CERT_FILE"
	envAdminTLSKeyFile              = "BINVAULT_ADMIN_TLS_KEY_FILE"
	envAdminInsecureHTTP            = "BINVAULT_ADMIN_INSECURE_HTTP"
	envEndpointURL                  = "BINVAULT_ENDPOINT_URL"
	envDomain                       = "BINVAULT_DOMAIN"
	envRegion                       = "BINVAULT_REGION"
	envTLSCertFile                  = "BINVAULT_TLS_CERT_FILE"
	envTLSKeyFile                   = "BINVAULT_TLS_KEY_FILE"
	envTrustedProxies               = "BINVAULT_TRUSTED_PROXIES"
	envDataDir                      = "BINVAULT_DATA_DIR"
	envFsync                        = "BINVAULT_FSYNC"
	envMinFreeMB                    = "BINVAULT_MIN_FREE_MB"
	envMaxObjectMB                  = "BINVAULT_MAX_OBJECT_MB"
	envGCGrace                      = "BINVAULT_GC_GRACE"
	envMultipartTTL                 = "BINVAULT_MULTIPART_TTL"
	envClockSkew                    = "BINVAULT_CLOCK_SKEW"
	envHeaderTimeout                = "BINVAULT_HEADER_TIMEOUT"
	envBodyIdleTimeout              = "BINVAULT_BODY_IDLE_TIMEOUT"
	envShutdownTimeout              = "BINVAULT_SHUTDOWN_TIMEOUT"
	envAuthFailLimit                = "BINVAULT_AUTH_FAIL_LIMIT"
	envScrubInterval                = "BINVAULT_SCRUB_INTERVAL"
	envLifecycleInterval            = "BINVAULT_LIFECYCLE_INTERVAL"
	envLifecycleBatch               = "BINVAULT_LIFECYCLE_BATCH"
	envPipelineWorkers              = "BINVAULT_PIPELINE_WORKERS"
	envPipelineBeforeTotalTimeout   = "BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT"
	envPipelineMaxDepth             = "BINVAULT_PIPELINE_MAX_DEPTH"
	envPipelineAllowPrivate         = "BINVAULT_PIPELINE_ALLOW_PRIVATE"
	envPipelineCAFile               = "BINVAULT_PIPELINE_CA_FILE"
	envPipelineRunRetention         = "BINVAULT_PIPELINE_RUN_RETENTION"
	envMetricsPerBucket             = "BINVAULT_METRICS_PER_BUCKET"
	envLogFormat                    = "BINVAULT_LOG_FORMAT"
	envLogLevel                     = "BINVAULT_LOG_LEVEL"
	envNodeName                     = "BINVAULT_NODE_NAME"
	envClusterURLs                  = "BINVAULT_CLUSTER_URLS"
	envClusterKey                   = "BINVAULT_CLUSTER_KEY"
	envClusterListen                = "BINVAULT_CLUSTER_LISTEN"
	envClusterTLSCertFile           = "BINVAULT_CLUSTER_TLS_CERT_FILE"
	envClusterTLSKeyFile            = "BINVAULT_CLUSTER_TLS_KEY_FILE"
	envClusterCAFile                = "BINVAULT_CLUSTER_CA_FILE"
	envClusterInsecureHTTP          = "BINVAULT_CLUSTER_INSECURE_HTTP"
	envClusterPullInterval          = "BINVAULT_CLUSTER_PULL_INTERVAL"
	envClusterMaxClockSkew          = "BINVAULT_CLUSTER_MAX_CLOCK_SKEW"
	envClusterStartupFence          = "BINVAULT_CLUSTER_STARTUP_FENCE"
	envClusterRetention             = "BINVAULT_CLUSTER_RETENTION"
	envClusterForwardConnectTimeout = "BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT"
	envMoveStreams                  = "BINVAULT_MOVE_STREAMS"
	envMoveFreezeTimeout            = "BINVAULT_MOVE_FREEZE_TIMEOUT"
)

const (
	// envPrefix is the namespace of every binvault variable.
	envPrefix = "BINVAULT_"
	// fileSuffix turns a secret variable's name into its file form.
	fileSuffix = "_FILE"
	// maxSuggestDistance is the largest edit distance at which an unknown
	// variable still gets a "did you mean" hint.
	maxSuggestDistance = 3
)

// variable describes one row of the §2.3 table.
type variable struct {
	name string
	// secret: the value is never shown, and <name>_FILE may give it instead.
	secret bool
	// cluster: read only when BINVAULT_CLUSTER_URLS is set; on a single node
	// it is ignored with a warning, never an error.
	cluster bool
}

// variables is the §2.3 table, in order.
var variables = []variable{
	{name: envAdminToken, secret: true},
	{name: envMasterKey, secret: true},
	{name: envMasterKeyOld, secret: true},
	{name: envListen},
	{name: envAdminListen},
	{name: envAdminTLSCertFile},
	{name: envAdminTLSKeyFile},
	{name: envAdminInsecureHTTP},
	{name: envEndpointURL},
	{name: envDomain},
	{name: envRegion},
	{name: envTLSCertFile},
	{name: envTLSKeyFile},
	{name: envTrustedProxies},
	{name: envDataDir},
	{name: envFsync},
	{name: envMinFreeMB},
	{name: envMaxObjectMB},
	{name: envGCGrace},
	{name: envMultipartTTL},
	{name: envClockSkew},
	{name: envHeaderTimeout},
	{name: envBodyIdleTimeout},
	{name: envShutdownTimeout},
	{name: envAuthFailLimit},
	{name: envScrubInterval},
	{name: envLifecycleInterval},
	{name: envLifecycleBatch},
	{name: envPipelineWorkers},
	{name: envPipelineBeforeTotalTimeout},
	{name: envPipelineMaxDepth},
	{name: envPipelineAllowPrivate},
	{name: envPipelineCAFile},
	{name: envPipelineRunRetention},
	{name: envMetricsPerBucket},
	{name: envLogFormat},
	{name: envLogLevel},
	{name: envNodeName, cluster: true},
	{name: envClusterURLs}, // the switch itself: setting it is what enables the others
	{name: envClusterKey, secret: true, cluster: true},
	{name: envClusterListen, cluster: true},
	{name: envClusterTLSCertFile, cluster: true},
	{name: envClusterTLSKeyFile, cluster: true},
	{name: envClusterCAFile, cluster: true},
	{name: envClusterInsecureHTTP, cluster: true},
	{name: envClusterPullInterval, cluster: true},
	{name: envClusterMaxClockSkew, cluster: true},
	{name: envClusterStartupFence, cluster: true},
	{name: envClusterRetention, cluster: true},
	{name: envClusterForwardConnectTimeout, cluster: true},
	{name: envMoveStreams, cluster: true},
	{name: envMoveFreezeTimeout, cluster: true},
}

// allNames lists every recognised variable in table order, each secret's
// _FILE form right after it; known is the same set, for lookups.
var allNames, known = buildNames()

func buildNames() ([]string, map[string]bool) {
	var names []string
	for _, v := range variables {
		names = append(names, v.name)
		if v.secret {
			names = append(names, v.name+fileSuffix)
		}
	}
	set := make(map[string]bool, len(names))
	for _, n := range names {
		set[n] = true
	}
	return names, set
}

// warnClusterVars warns about every cluster variable that is set on a single
// node. They are never parsed there, so a cluster setting left behind can
// never fail a boot.
func (l *loader) warnClusterVars() {
	for _, v := range variables {
		if !v.cluster {
			continue
		}
		names := []string{v.name}
		if v.secret {
			names = append(names, v.name+fileSuffix)
		}
		for _, n := range names {
			if _, ok := l.env(n); ok {
				l.warn(n, "has no effect in single-node mode (%s is not set)", envClusterURLs)
			}
		}
	}
}

// warnUnknown warns about every key that looks like a binvault variable —
// the BINVAULT_ prefix is matched without regard to case — but is not one,
// in name order, suggesting the closest known name. Only names appear in
// the warning, never values: a misspelt secret stays secret.
func (l *loader) warnUnknown(keys []string) {
	var unknown []string
	for _, k := range keys {
		if strings.HasPrefix(strings.ToUpper(k), envPrefix) && !known[k] && !slices.Contains(unknown, k) {
			unknown = append(unknown, k)
		}
	}
	slices.Sort(unknown)
	for _, k := range unknown {
		l.warn(k, "unknown variable, ignored%s", suggestion(k))
	}
}

// suggestion is the hint appended to an unknown-variable warning: the known
// name within maxSuggestDistance edits (ignoring case) that is closest, the
// earliest in table order on a tie, or an explanation when a non-secret
// variable was given a _FILE form.
func suggestion(name string) string {
	upper := strings.ToUpper(name)
	if stem, ok := strings.CutSuffix(upper, fileSuffix); ok {
		for _, v := range variables {
			if v.name == stem && !v.secret {
				return " (only " + envAdminToken + ", " + envMasterKey + ", " + envMasterKeyOld +
					" and " + envClusterKey + " accept a " + fileSuffix + " form)"
			}
		}
	}
	best, bestDist := "", maxSuggestDistance+1
	for _, k := range allNames {
		if d := levenshtein(upper, k); d < bestDist {
			best, bestDist = k, d
		}
	}
	if best == "" {
		return ""
	}
	return " (did you mean " + best + "?)"
}

// levenshtein is the edit distance between a and b, counted in runes.
func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	prev := make([]int, len(rb)+1)
	cur := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev, cur = cur, prev
	}
	return prev[len(rb)]
}
