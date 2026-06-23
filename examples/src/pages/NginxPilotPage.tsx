import { Link as RouterLink } from 'react-router'
import { CodeBlock, CopyLine } from './_chrome'

const archDiagram = `git remotes / zip endpoints ──fetch──► nginxpilot ──writes──► data_dir/sites/<domain>/
                                                                    releases/<ts>-<ref>/
                                                                    current -> releases/...  (atomic symlink)
                                                                             ▲
                                             nginx  root = .../current ─────┘`

const configExample = `# /etc/nginxpilot/config.yml — globals + includes
data_dir: /var/lib/nginxpilot
admin:
  listen: 127.0.0.1:9090          # health + status + manual sync trigger
  # token_env: NGINXPILOT_TOKEN   # bearer auth on all admin routes; omit to disable

defaults:
  interval: 5m
  keep_releases: 3

include:
  - sites.d/*.yml                 # fragments may contain only sites: lists
                                  # duplicate domains across files are a validation error
                                  # drop a file in, kill -HUP — that's onboarding`

const gitSourceExample = `# /etc/nginxpilot/sites.d/example.com.yml
sites:
  - domain: example.com
    source:
      type: git
      url: git@github.com:acme/example-site.git
      branch: main
      interval: 2m                # min 30s; defaults to defaults.interval
      auth:
        method: ssh-key           # ssh-key | https-token | none
        key_file: /etc/nginxpilot/keys/example_ed25519
        # known_hosts: /etc/nginxpilot/known_hosts   # strict check; default: accept-new (TOFU)
      subdir: dist/               # serve only this subtree of the repo
      require_file: [index.html]  # post-fetch gate: reject release if file is absent
    exclude: ["*.map"]            # extends defaults strip list:
                                  # .env*, .htaccess, .DS_Store  (.git* always stripped)`

const httpZipSourceExample = `sites:
  - domain: blog.example.com
    source:
      type: http-zip
      url: https://ci.example.com/artifacts/blog/latest.zip   # https required
      # allow_insecure: true      # permit http:// URLs (not recommended)
      interval: 10m
      auth:
        method: bearer            # bearer | basic | header | none
        token_env: BLOG_ARTIFACT_TOKEN
      checksum_url: https://ci.example.com/artifacts/blog/latest.zip.sha256  # optional
      # strip_components: 1       # explicit; a single shared root dir is auto-stripped
      limits:                     # zip-bomb guards (these are the defaults)
        max_archive_size: 512MiB
        max_uncompressed_size: 2GiB
        max_entries: 100000
        max_compression_ratio: 100

# Downloads use conditional GET (ETag / Last-Modified) — unchanged content is a cheap no-op.
# Extraction rejects zip-slip paths and symlinks outright.`

const secretsExample = `# Inline secrets are a PARSE-TIME ERROR — only _env / _file refs are accepted.
# Config files stay safe to commit.
auth:
  method: https-token
  token_env: MY_TOKEN           # reads $MY_TOKEN at runtime
  # token_file: /run/secrets/my_token   # or point at a file

# Secret files must be 0600 or 0640 and owned by the daemon user or root.
# The daemon refuses to start if permissions are wrong.

# systemd LoadCredential integration:
# [Service]
# LoadCredential=my_token:/etc/nginxpilot/tokens/my_token
# then in config:
#   token_file: /run/credentials/nginxpilot.service/my_token`

const cliReference = `nginxpilot run [--config PATH] [--log-format logfmt|json] [--prune-orphans]
                        # the daemon; --prune-orphans deletes content dirs for sites
                        # that were removed from config (orphans are warned, not deleted, by default)
nginxpilot validate             # parse + validate merged config, CI exit codes
nginxpilot sync <domain>        # one-shot sync, no daemon needed (onboarding)
nginxpilot print-vhost <domain> # nginx server-block starting snippet
nginxpilot status [--json]      # per-site table from the daemon
nginxpilot version              # build info`

const adminEndpoints = `GET  /healthz           — liveness probe
GET  /status            — per-site JSON: deployed ref, last success/error,
                          failure_streak, never_synced, next sync time
POST /sync/<domain>     — force an immediate out-of-schedule sync

# admin.token_env enables bearer auth on all three routes:
# admin:
#   listen: 127.0.0.1:9090
#   token_env: NGINXPILOT_TOKEN

curl -H "Authorization: Bearer $NGINXPILOT_TOKEN" http://127.0.0.1:9090/status
curl -X POST -H "Authorization: Bearer $NGINXPILOT_TOKEN" http://127.0.0.1:9090/sync/example.com`

const signalsSnippet = `SIGHUP   — diff-based reload
           added sites:    start and sync immediately
           removed sites:  stop the watcher; content stays on disk (orphan, warned)
                           remove orphaned content by restarting with --prune-orphans
           invalid config: rejected wholesale; running config stays active

SIGTERM / SIGINT — graceful shutdown
           in-flight symlink swaps finish; downloads abort cleanly`

const releasesSnippet = `data_dir/sites/<domain>/
  releases/
    20240601T120000-abc1234/    # <RFC3339-ts>-<git-ref|etag>
    20240601T120512-def5678/
    20240602T080000-ghi9012/    # newest successful sync
  current -> releases/20240602T080000-ghi9012   # atomic rename(2) swap

# keep_releases: 3 (default) — oldest release dirs pruned after each sync
# Manual rollback: point current at an older release directory (no restart needed)`

const backoffSnippet = `# Retry formula: interval × 2^streak — capped at 4× interval
# streak resets to 0 on success; visible in GET /status as failure_streak
# current symlink is never overwritten on failure — last good content stays live
#
# Example with defaults.interval: 5m
#   streak 0 → next retry in  5m
#   streak 1 → next retry in 10m
#   streak 2 → next retry in 20m
#   streak 3+ → retry in 20m  (4 × 5m cap)`

const nginxSnippet = `server {
    listen 80;
    server_name example.com;

    # swapped atomically via rename(2) — no nginx reload on content updates
    root /var/lib/nginxpilot/sites/example.com/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`

const systemdSnippet = `# packaging/nginxpilot.service (ships in the repo)
[Service]
Type=notify
Restart=on-failure
User=nginxpilot
UMask=0027
ProtectSystem=strict
NoNewPrivileges=true
PrivateTmp=true
# Run as a dedicated nginxpilot user owning data_dir;
# the nginx worker user joins the nginxpilot group.
# Dirs 0750, files 0640 (enforced by umask 027).

# SELinux — RHEL-family only:
semanage fcontext -a -t httpd_sys_content_t '/var/lib/nginxpilot/sites(/.*)?' \\
  && restorecon -R /var/lib/nginxpilot/sites`

const features = [
    {
        title: 'Atomic deploys',
        body: 'Content is staged, fsynced, then made live with a rename(2) symlink swap. nginx never serves a half-written directory; updates need no nginx reload.',
    },
    {
        title: 'Last known-good wins',
        body: 'Any sync failure — network error, bad auth, corrupt archive — leaves the current release untouched. Retries back off exponentially, capped at 4× the interval.',
    },
    {
        title: 'Two source types',
        body: 'git (shallow single-branch via the system git binary) and http-zip (conditional GET, checksum option). Both support private sources via env/file secret refs.',
    },
    {
        title: 'Hardened by default',
        body: 'Zip-slip and symlink rejection, zip-bomb limits, .git*/.env* always stripped, inline secrets are a parse error, unprivileged daemon with a strict systemd unit.',
    },
]

export const NginxPilotPage = () => {
    return (
        <main className="site-container">
            <div className="breadcrumbs">
                <RouterLink to="/apps">Apps</RouterLink>
                <span className="sep">/</span>
                <span className="current mono">nginxpilot</span>
            </div>

            <section className="page-intro">
                <div>
                    <div className="eyebrow">App · Daemon · Go</div>
                    <h1 className="page-title mono">nginxpilot</h1>
                    <p className="page-lead">
                        A standalone Go daemon that runs alongside nginx and keeps directories of
                        static files in sync with remote sources — git repositories or HTTP zip
                        archives. nginx serves the files; the daemon never sits in the request path.
                    </p>
                    <div className="chip-row">
                        {['Go', 'git', 'http-zip', 'systemd', 'Docker', 'zero request-path coupling'].map((chip) => (
                            <span key={chip} className="tag">{chip}</span>
                        ))}
                    </div>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Language</dt>
                        <dd>Go 1.24</dd>
                    </div>
                    <div>
                        <dt>Source types</dt>
                        <dd>git · http-zip</dd>
                    </div>
                    <div>
                        <dt>Dependencies</dt>
                        <dd>2</dd>
                    </div>
                    <div>
                        <dt>License</dt>
                        <dd>MIT</dd>
                    </div>
                </dl>
            </section>

            <div className="section-head">
                <h2>How it works</h2>
                <span className="count">pull → stage → atomic swap</span>
            </div>
            <CodeBlock file="architecture" code={archDiagram} />

            <div className="lib-grid">
                {features.map((f) => (
                    <div key={f.title} className="lib-card">
                        <div className="lib-card-head">
                            <div>
                                <h3 className="lib-name">{f.title}</h3>
                                <p className="lib-tagline">{f.body}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="section-head">
                <h2>Configuration</h2>
                <span className="count">declarative YAML · strict unknown-key errors · sites.d/ fragments</span>
            </div>
            <CodeBlock file="config.yml" code={configExample} />

            <div className="section-head">
                <h2>git source</h2>
                <span className="count">shallow single-branch · subdir · require_file · TOFU or known_hosts</span>
            </div>
            <CodeBlock file="sites.d/example.com.yml" code={gitSourceExample} />

            <div className="section-head">
                <h2>http-zip source</h2>
                <span className="count">conditional GET · checksum · zip-bomb limits · bearer / basic / header auth</span>
            </div>
            <CodeBlock file="sites.d/blog.example.com.yml" code={httpZipSourceExample} />

            <div className="section-head">
                <h2>Secrets</h2>
                <span className="count">_env / _file refs only · 0600/0640 enforcement · systemd LoadCredential</span>
            </div>
            <CodeBlock file="secrets.yml" code={secretsExample} />

            <div className="section-head">
                <h2>CLI</h2>
                <span className="count">single binary</span>
            </div>
            <CodeBlock file="cli-reference.sh" code={cliReference} />

            <div className="section-head">
                <h2>Admin endpoint</h2>
                <span className="count">loopback HTTP · /healthz · /status · /sync/&lt;domain&gt;</span>
            </div>
            <CodeBlock file="admin.sh" code={adminEndpoints} />

            <div className="section-head">
                <h2>Signals</h2>
                <span className="count">SIGHUP diff-reload · SIGTERM/SIGINT graceful shutdown</span>
            </div>
            <CodeBlock file="signals.txt" code={signalsSnippet} />

            <div className="section-head">
                <h2>Release retention</h2>
                <span className="count">keep_releases · timestamped dirs · atomic current symlink</span>
            </div>
            <CodeBlock file="releases.txt" code={releasesSnippet} />

            <div className="section-head">
                <h2>Failure &amp; backoff</h2>
                <span className="count">interval × 2^streak · capped at 4× · streak visible in /status</span>
            </div>
            <CodeBlock file="backoff.txt" code={backoffSnippet} />

            <div className="section-head">
                <h2>nginx integration</h2>
                <span className="count">the daemon never touches nginx config</span>
            </div>
            <CodeBlock file="example.com.conf" code={nginxSnippet} />

            <div className="section-head">
                <h2>systemd &amp; SELinux</h2>
                <span className="count">Type=notify · hardening · 0750/0640 umask · httpd_sys_content_t</span>
            </div>
            <CodeBlock file="nginxpilot.service" code={systemdSnippet} />

            <div className="section-head">
                <h2>Run it</h2>
                <span className="count">binary, systemd or Docker</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="docker pull ghcr.io/kalevski/toolcase/nginxpilot:latest" />
                <CopyLine cmd="nginxpilot validate && nginxpilot sync example.com" />
            </div>

            <div className="section-head">
                <h2>Source</h2>
                <span className="count">lives in the toolcase monorepo</span>
            </div>
            <div className="lib-grid">
                <a
                    href="https://github.com/kalevski/toolcase/tree/main/nginxpilot"
                    target="_blank"
                    rel="noreferrer"
                    className="lib-card"
                >
                    <div className="lib-card-head">
                        <div>
                            <h3 className="lib-name">kalevski/toolcase</h3>
                            <p className="lib-tagline">nginxpilot/ — Go module, README, systemd unit, Dockerfile</p>
                        </div>
                        <span className="lib-arrow">→</span>
                    </div>
                </a>
            </div>
        </main>
    )
}
