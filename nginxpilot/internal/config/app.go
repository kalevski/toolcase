package config

import (
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"
)

// App runtimes. An app is code that executes, as opposed to a Site, which is
// files that are served. Only PHP exists today; the field is a closed union so
// a second runtime slots in without reshaping the entity.
const (
	RuntimePHP = "php"
)

// PHP request-routing strategies.
const (
	PHPRoutingFrontController = "front-controller"
	PHPRoutingStaticFirst     = "static-first"
)

// Defaults applied when an app leaves the field empty.
const (
	DefaultPHPIndex       = "index.php"
	DefaultPHPTimeout     = 60 * time.Second
	DefaultPHPMemoryLimit = "256M"
	DefaultPHPMaxChildren = 8
	DefaultPHPMaxBodySize = 32 << 20 // 32MiB
)

// PersistentDirName is the per-app directory that outlives every release. It
// is the only thing a php app may write to, and the deployer symlinks declared
// paths inside each new release at it.
const PersistentDirName = "persistent"

// MaxPHPEnv caps the per-app fastcgi_param map. Each entry is one line in every
// executable location, so an unbounded map is an unbounded vhost.
const MaxPHPEnv = 100

// phpEnvKey is the CGI variable-name shape. nginx would accept more, but a name
// php cannot read from $_SERVER is a value the application never sees.
var phpEnvKey = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// MaxPersistentPaths caps the declared persistent list. The bound exists so a
// fragment cannot make the deploy walk unbounded work; it is far above what a
// real application declares (WordPress needs three).
const MaxPersistentPaths = 64

// App is a vhost whose content is executed rather than served. It shares the
// site/proxy/redirect/dead-host domain namespace and carries the same
// WebOptions, so TLS and the per-host toggles behave identically to a Site.
type App struct {
	Domain string `yaml:"domain" json:"domain"`
	// Enabled toggles the app without deleting it (nil/absent = enabled).
	Enabled *bool `yaml:"enabled" json:"enabled,omitempty"`
	// Runtime selects the execution model. Only "php" today.
	Runtime string `yaml:"runtime" json:"runtime"`
	// Source is the same git / http-zip shape a Site uses, synced by the same
	// deployer into apps/<domain>/releases/.
	Source  Source   `yaml:"source" json:"source"`
	Exclude []string `yaml:"exclude" json:"exclude,omitempty"`

	// PHP carries the runtime-specific settings. Required when Runtime is php.
	PHP AppPHP `yaml:"php" json:"php"`

	// WebOptions are the per-host HTTP toggles shared with Site and Proxy.
	WebOptions `yaml:",inline"`

	// File records which config file declared this app (provenance for
	// duplicate-domain errors and logs). Never serialized over the admin API.
	File string `yaml:"-" json:"-"`
}

// AppPHP is the php runtime block of an app.
type AppPHP struct {
	// Routing selects the request-path → script strategy.
	Routing string `yaml:"routing" json:"routing,omitempty"`
	// Index is the front controller, relative to the document root.
	Index string `yaml:"index" json:"index,omitempty"`
	// Persistent lists release-relative paths that live outside the release and
	// are symlinked into every new one, so an application that writes to its own
	// document root keeps that data across deploys.
	Persistent []string `yaml:"persistent" json:"persistent,omitempty"`
	// Expose lists extra release-relative scripts allowed to execute beyond the
	// front controller. Empty (the default) means only Index runs.
	Expose []string `yaml:"expose" json:"expose,omitempty"`

	// Env carries per-app values the application reads from its request
	// environment. They are rendered as fastcgi_param lines inside every
	// executable location, which is how php-fpm sees a value nginx sets: there is
	// no per-pool env here because a pool is shared across a release swap while
	// the vhost is rewritten on every config apply.
	Env map[string]string `yaml:"env" json:"env,omitempty"`

	MaxBodySize ByteSize `yaml:"max_body_size" json:"max_body_size,omitempty"`
	Timeout     Duration `yaml:"timeout" json:"timeout,omitempty"`
	MemoryLimit string   `yaml:"memory_limit" json:"memory_limit,omitempty"`
	MaxChildren int      `yaml:"max_children" json:"max_children,omitempty"`
}

// PHP is the daemon-level php-fpm configuration (outside the apps: list).
type PHP struct {
	// Enabled turns the php runtime on. With it false an apps: entry using
	// runtime php is a validation error rather than a silently dead vhost.
	Enabled bool `yaml:"enabled" json:"enabled"`
	// Version is informational — the image decides which php-fpm is installed.
	// It is reported in /status so a control plane can match app requirements.
	Version string `yaml:"version" json:"version,omitempty"`
	// PoolDir is the directory nginxpilot owns and writes pool files into, the
	// php-fpm twin of nginx.conf_dir.
	PoolDir string `yaml:"pool_dir" json:"pool_dir,omitempty"`
	// SocketDir holds the per-app unix sockets nginx connects to.
	SocketDir string `yaml:"socket_dir" json:"socket_dir,omitempty"`
	// RunAs is the user each pool runs as when an app does not get its own uid.
	// Per-app uids are the isolation floor; this is the fallback for
	// single-tenant installs that have not provisioned them.
	RunAs string `yaml:"run_as" json:"run_as,omitempty"`
	// SocketOwner is the user that must be able to connect to the pool socket —
	// nginx's worker user.
	SocketOwner string `yaml:"socket_owner" json:"socket_owner,omitempty"`

	TestCmd   []string `yaml:"test_cmd" json:"test_cmd,omitempty"`
	ReloadCmd []string `yaml:"reload_cmd" json:"reload_cmd,omitempty"`
}

// Enabled reports whether the app renders (nil pointer = enabled).
func (a App) IsEnabled() bool { return a.Enabled == nil || *a.Enabled }

// RuntimeMode returns the effective runtime ("" → php, the only one).
func (a App) RuntimeMode() string {
	if a.Runtime == "" {
		return RuntimePHP
	}
	return a.Runtime
}

// RoutingMode returns the effective php routing strategy.
func (p AppPHP) RoutingMode() string {
	if p.Routing == "" {
		return PHPRoutingFrontController
	}
	return p.Routing
}

// IndexFile returns the effective front controller.
func (p AppPHP) IndexFile() string {
	if p.Index == "" {
		return DefaultPHPIndex
	}
	return p.Index
}

// TimeoutOrDefault returns the effective fastcgi_read_timeout.
func (p AppPHP) TimeoutOrDefault() time.Duration {
	if p.Timeout > 0 {
		return time.Duration(p.Timeout)
	}
	return DefaultPHPTimeout
}

// MemoryLimitOrDefault returns the effective php memory_limit.
func (p AppPHP) MemoryLimitOrDefault() string {
	if p.MemoryLimit == "" {
		return DefaultPHPMemoryLimit
	}
	return p.MemoryLimit
}

// MaxChildrenOrDefault returns the effective pm.max_children.
func (p AppPHP) MaxChildrenOrDefault() int {
	if p.MaxChildren > 0 {
		return p.MaxChildren
	}
	return DefaultPHPMaxChildren
}

// MaxBodySizeOrDefault returns the effective client_max_body_size in bytes.
func (p AppPHP) MaxBodySizeOrDefault() int64 {
	if p.MaxBodySize > 0 {
		return int64(p.MaxBodySize)
	}
	return DefaultPHPMaxBodySize
}

// Interval returns the effective poll interval for the app.
func (a App) Interval(d Defaults) time.Duration {
	if a.Source.Interval > 0 {
		return time.Duration(a.Source.Interval)
	}
	if d.Interval > 0 {
		return time.Duration(d.Interval)
	}
	return 5 * time.Minute
}

// KeepReleases returns the effective keep_releases for the app.
func (a App) KeepReleases(d Defaults) int {
	if a.Source.KeepReleases != nil && *a.Source.KeepReleases > 0 {
		return *a.Source.KeepReleases
	}
	if d.KeepReleases > 0 {
		return d.KeepReleases
	}
	return defaultKeepReleases
}

// AsSite adapts an app to the Site shape the source-fetch and content-gate
// pipeline already consumes, so apps deploy through exactly the same fetch →
// excludes → gates → atomic-swap path that sites do rather than a parallel copy
// of it. Only the fields that pipeline reads are carried across.
func (a App) AsSite() Site {
	return Site{
		Domain:  a.Domain,
		Source:  a.Source,
		Exclude: a.Exclude,
		File:    a.File,
	}
}

// CleanRelPath validates a release-relative path supplied by config. It must be
// relative, clean, free of .. and not escape the release root. This is the gate
// that stops `persistent: ["../../etc"]` from linking a release entry at an
// arbitrary filesystem location, and it runs at parse time rather than at
// deploy time so a bad fragment never reaches the disk.
func CleanRelPath(field, p string) (string, error) {
	if p == "" {
		return "", fmt.Errorf("%s: empty path", field)
	}
	if path.IsAbs(p) || strings.HasPrefix(p, "/") {
		return "", fmt.Errorf("%s %q: must be relative to the release root", field, p)
	}
	if strings.ContainsRune(p, '\\') {
		return "", fmt.Errorf("%s %q: backslashes are not path separators", field, p)
	}
	cleaned := path.Clean(p)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "/../") {
		return "", fmt.Errorf("%s %q: must not contain ..", field, p)
	}
	if cleaned != strings.TrimSuffix(p, "/") && cleaned != p {
		return "", fmt.Errorf("%s %q: must be a clean path (%q)", field, p, cleaned)
	}
	return cleaned, nil
}

func validateApp(app *App, php PHP) error {
	ascii, err := normalizeDomain(app.Domain)
	if err != nil {
		return err
	}
	app.Domain = ascii

	switch app.RuntimeMode() {
	case RuntimePHP:
	default:
		return fmt.Errorf("runtime %q: must be php", app.Runtime)
	}
	if !php.Enabled {
		return fmt.Errorf("runtime php requires php.enabled: true in the daemon config")
	}

	if app.Source.Interval > 0 && time.Duration(app.Source.Interval) < MinInterval {
		return fmt.Errorf("interval %s: minimum is %s", app.Source.Interval, MinInterval)
	}
	if err := checkNoInlineSecrets(app.Source.Auth); err != nil {
		return err
	}
	// The same source rules a site gets: type, URL scheme, branch, and which
	// auth methods that type actually supports. An app used to skip all of it.
	if err := validateSource(&app.Source); err != nil {
		return err
	}

	switch app.PHP.RoutingMode() {
	case PHPRoutingFrontController, PHPRoutingStaticFirst:
	default:
		return fmt.Errorf("php.routing %q: must be front-controller | static-first", app.PHP.Routing)
	}

	index, err := CleanRelPath("php.index", app.PHP.IndexFile())
	if err != nil {
		return err
	}
	if !strings.HasSuffix(index, ".php") {
		return fmt.Errorf("php.index %q: must be a .php file", app.PHP.Index)
	}
	app.PHP.Index = index

	if len(app.PHP.Persistent) > MaxPersistentPaths {
		return fmt.Errorf("php.persistent: %d paths exceeds the maximum of %d", len(app.PHP.Persistent), MaxPersistentPaths)
	}
	seenPersistent := map[string]bool{}
	for i, p := range app.PHP.Persistent {
		cleaned, err := CleanRelPath("php.persistent", p)
		if err != nil {
			return err
		}
		if seenPersistent[cleaned] {
			return fmt.Errorf("php.persistent %q: listed twice", cleaned)
		}
		// A path nested under another persistent path would be linked twice and
		// the inner link would land inside the outer target — reject rather than
		// produce a tree nobody can reason about.
		for other := range seenPersistent {
			if strings.HasPrefix(cleaned+"/", other+"/") || strings.HasPrefix(other+"/", cleaned+"/") {
				return fmt.Errorf("php.persistent %q overlaps %q", cleaned, other)
			}
		}
		seenPersistent[cleaned] = true
		app.PHP.Persistent[i] = cleaned
	}

	for i, e := range app.PHP.Expose {
		cleaned, err := CleanRelPath("php.expose", e)
		if err != nil {
			return err
		}
		if !strings.HasSuffix(cleaned, ".php") {
			return fmt.Errorf("php.expose %q: must be a .php file", e)
		}
		app.PHP.Expose[i] = cleaned
	}

	if len(app.PHP.Env) > MaxPHPEnv {
		return fmt.Errorf("php.env: %d values exceeds the maximum of %d", len(app.PHP.Env), MaxPHPEnv)
	}
	for k, v := range app.PHP.Env {
		if !phpEnvKey.MatchString(k) {
			return fmt.Errorf("php.env %q: must match [A-Za-z_][A-Za-z0-9_]*", k)
		}
		if strings.ContainsAny(v, "\n\r") {
			return fmt.Errorf("php.env %q: value must not contain a newline", k)
		}
	}

	if app.PHP.MaxChildren < 0 {
		return fmt.Errorf("php.max_children must be >= 0")
	}
	if app.PHP.Timeout < 0 {
		return fmt.Errorf("php.timeout must be >= 0")
	}
	if app.PHP.MemoryLimit != "" && !validMemoryLimit(app.PHP.MemoryLimit) {
		return fmt.Errorf("php.memory_limit %q: must look like 256M, 1G or -1", app.PHP.MemoryLimit)
	}

	if app.Source.Subdir != "" {
		sub := path.Clean(app.Source.Subdir)
		if path.IsAbs(sub) || sub == ".." || strings.HasPrefix(sub, "../") {
			return fmt.Errorf("subdir %q must be relative and must not contain ..", app.Source.Subdir)
		}
	}

	switch app.Source.Type {
	case SourceGit:
		return validateGitSource(&app.Source)
	case SourceHTTPZip:
		return validateHTTPZipSource(&app.Source)
	case "":
		return fmt.Errorf("source.type is required (git | http-zip)")
	default:
		return fmt.Errorf("source.type %q: must be git or http-zip", app.Source.Type)
	}
}

// validMemoryLimit accepts php's own memory_limit spelling: an integer with an
// optional K/M/G suffix, or -1 for unlimited.
func validMemoryLimit(v string) bool {
	if v == "-1" {
		return true
	}
	digits := strings.TrimRight(v, "KMGkmg")
	if digits == "" || len(v)-len(digits) > 1 {
		return false
	}
	for _, r := range digits {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func validatePHP(cfg *Config) error {
	if !cfg.PHP.Enabled {
		return nil
	}
	if cfg.PHP.PoolDir == "" {
		return fmt.Errorf("php.pool_dir is required when php.enabled")
	}
	if !path.IsAbs(cfg.PHP.PoolDir) {
		return fmt.Errorf("php.pool_dir %q must be an absolute path", cfg.PHP.PoolDir)
	}
	if cfg.PHP.SocketDir == "" {
		return fmt.Errorf("php.socket_dir is required when php.enabled")
	}
	if !path.IsAbs(cfg.PHP.SocketDir) {
		return fmt.Errorf("php.socket_dir %q must be an absolute path", cfg.PHP.SocketDir)
	}
	return nil
}
