import { CopyLine } from './_chrome'
import { AppIntro, CodeSection, FeatureGrid, SectionHead, SourceCard } from './_app'

const archDiagram = `git remotes / zip endpoints ──fetch──► nginxpilot ──writes──► data_dir/sites/<domain>/
                                                                    releases/<ts>-<ref>/
                                                                    current -> releases/...  (atomic symlink)
                                                                             ▲
                                             nginx  root = .../current ─────┘

managed mode (opt-in):  nginxpilot ──renders──► conf.d/nginxpilot.d/*.conf ──nginx -t──► reload`

const configExample = `# /etc/nginxpilot/config.yml — globals + includes
data_dir: /var/lib/nginxpilot
admin:
  listen: 127.0.0.1:9090          # health, status, REST config API
  # token_env: NGINXPILOT_TOKEN   # bearer auth on all admin routes; omit to disable

defaults:
  interval: 5m
  keep_releases: 3

include:
  - sites.d/*.yml                 # fragments may hold sites:, upstreams:, proxies:, …
                                  # sites, apps, proxies, redirects and dead hosts share
                                  # one domain namespace — duplicates are a validation error
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
        method: ssh-key           # ssh-key | https-token | github-token | none
        key_file: /etc/nginxpilot/keys/example_ed25519
        # key_env: SSH_KEY        # or: env var holding the key material (containers)
        # known_hosts: /etc/nginxpilot/known_hosts   # strict; default accept-new (TOFU)
      subdir: dist/               # serve only this subtree of the repo
      require_file: [index.html]  # post-fetch gate: reject release if file is absent
    exclude: ["*.map"]            # extends defaults: .env*, .htaccess, .DS_Store (.git* always)
    routing: spa                  # static (default) | spa | clean-urls
    not_found: /404.html          # custom 404 (static / clean-urls only)
    cache_assets: true            # immutable Cache-Control for fingerprinted assets

# github-token: token-only auth for a private GitHub repo over https://
#   auth: { method: github-token, token_env: GITHUB_TOKEN }
#   export GITHUB_TOKEN=$(gh auth token)`

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

const proxiesExample = `upstreams:
  - name: api_pool
    balancer: least_conn           # round_robin | least_conn | ip_hash
    keepalive: 32
    servers:
      - { address: 10.0.0.1:8080, weight: 2, max_fails: 3, fail_timeout: 30s }
      - { address: 10.0.0.2:8080, backup: true }

proxies:
  - domain: api.example.com
    upstream: api_pool             # … or pass: http://127.0.0.1:9000 (exactly one)
    client_max_body_size: 20MiB
    locations:
      - path: /ws
        upstream: api_pool
        websocket: true            # Upgrade/Connection headers + HTTP/1.1

redirects:
  - domain: old.example.com
    to: new.example.com
    code: 301                      # 301 | 302 | 303 | 307 | 308
    preserve_path: true

dead_hosts:
  - domain: gone.example.com
    code: 410                      # 404 | 410 | 444 | 503

# Proxies, redirects and dead hosts accept one leading wildcard label (*.example.com).
# Generate-only mode: nginxpilot print-vhost api.example.com → paste into nginx.`

const managedExample = `nginx:
  manage: true                                        # opt-in; default false
  conf_dir: /etc/nginx/conf.d/nginxpilot.d
  stream_conf_dir: /etc/nginx/stream.d/nginxpilot.d
  default_catch_all: false                            # silent 444 for unclaimed hosts
  reconcile:
    interval: 1m                                      # staged nginx -t dry-run every tick
    on_failure: warn                                  # warn | disable
    watch_addresses: true                             # reload when a backend's IP moved
tls:
  cert_dir: /etc/letsencrypt/live                     # certbot live or flat <domain>.crt/.key
  reload_on_change: true
acme:
  enabled: true
  renewal: { check_interval: 1h, renew_before: 24h }

proxies:
  - domain: app.example.com
    upstream: app_pool
    tls: auto                    # off | auto | required
    force_ssl: true
    http2: true
    hsts: true
    block_exploits: true
    cache: { enabled: true, valid: ["200 10m", "404 1m"] }
    gzip: true
    advanced: |                  # raw escape hatch — rides the same nginx -t gate
      add_header X-Frame-Options SAMEORIGIN;

streams:                         # L4 TCP/UDP in nginx's stream {} context
  - name: postgres
    listen: 5432
    pass: 10.0.0.9:5432`

const crashProofSnippet = `render one file per resource → nginx -t on the whole set in a staging dir
  all valid        → atomic swap into the live dirs → reload
  something broken → quarantine pass: add resources one at a time, nginx -t after each,
                     disable only the offender (its nginx -t stderr lands in /status)
  reload fails     → roll the live dirs back to the previous snapshot

nginx is only ever handed config that already passed nginx -t.`

const phpExample = `php:
  enabled: true
  pool_dir: /etc/php/pool.d
  socket_dir: /run/php

apps:
  - domain: shop.example.com
    runtime: php
    source:
      type: git
      url: https://github.com/acme/shop.git
      branch: main
    php:
      routing: front-controller   # front-controller (default) | static-first
      index: index.php
      persistent:                 # outside the release, symlinked into every deploy
        - wp-content/uploads
      max_body_size: 32MiB
      memory_limit: 256M
      max_children: 8
    tls: auto
    force_ssl: true

# One php-fpm pool per app: own uid, open_basedir, pm = ondemand.
# An uploaded .php never executes — only the front controller reaches fastcgi.
# A pool that is down disables the app instead of serving index.php as text.`

const logsExample = `logs:
  access:
    enabled: true                  # JSON access log → loopback UDP syslog the daemon owns
    syslog_listen: 127.0.0.1:5514
  daemon:
    enabled: true                  # also ship nginxpilot's own records (syncs, applies, renewals)
    level: info
  redact:
    anonymize_ip: false            # query-param deny-list always runs at intake

log_destinations:
  - name: main-loki
    type: loki                     # loki | http | file | stdout
    url: https://loki.example.com/loki/api/v1/push
    auth: { method: basic, username: loki, password_env: LOKI_PASSWORD }
    labels: { job: nginx, host: $resource, status_code: $status_class }
    filter:
      status: ["4xx", "5xx"]
      path: ["!/healthz"]

# Bounded ring buffers, batching, backoff honouring Retry-After —
# a dead Loki never blocks nginx, a sync, or the daemon.`

const secretsExample = `# Inline secrets are a PARSE-TIME ERROR — only _env / _file refs are accepted.
# Config files stay safe to commit.
auth:
  method: https-token
  username: deploy
  token_env: MY_TOKEN           # reads $MY_TOKEN at runtime
  # token_file: /run/secrets/my_token

# Secret files must be 0600 or 0640 and owned by the daemon user or root.
# systemd LoadCredential works via token_file + $CREDENTIALS_DIRECTORY.`

const cliReference = `nginxpilot run [--config PATH] [--log-format logfmt|json] [--prune-orphans]
nginxpilot validate [--check-targets]  # merged config + secret refs; nginx -t in managed mode
nginxpilot sync <domain>               # one-shot sync, no daemon needed (onboarding)
nginxpilot print-vhost <domain>        # server block for a site, or upstream{} + proxy_pass
nginxpilot print-include               # nginx.conf include + stream{} block for managed mode
nginxpilot print-logformat             # JSON access-log log_format for generate-only setups
nginxpilot status [--json]             # per-site table from the daemon
nginxpilot version`

const adminEndpoints = `GET  /healthz                 liveness
GET  /status                  per-site: deployed ref, bytes, streak, next sync
                              + nginx resources, php pools, certs_renewal, logs
POST /sync/<domain>           force an out-of-schedule sync
GET  /vhost/<domain>          generated nginx config (same as print-vhost)
POST /reload                  diff-based reload (same as SIGHUP)
POST /nginx/test              managed-mode dry run, per-resource pass/fail

# REST config — each write validates the merged candidate before touching disk
GET|POST       /sites  /upstreams  /proxies  /redirects  /dead-hosts
GET|POST       /apps  /streams  /stream-upstreams  /log-destinations
DELETE         /<kind>/{domain|name}       (409 if an upstream is still referenced)
GET|POST       /certs            POST returns 202 + job id; certbot runs in the background
POST           /certs/{domain}/renew

curl -X POST -H "Authorization: Bearer $NGINXPILOT_TOKEN" \\
  http://127.0.0.1:9090/proxies --data-binary @proxy.yml`

const signalsSnippet = `SIGHUP   — diff-based reload
           added sites:    start and sync immediately
           removed sites:  stop the watcher; content stays on disk (orphan, warned)
                           remove orphaned content by restarting with --prune-orphans
           invalid config: rejected wholesale; running config stays active
           managed mode:   re-render, nginx -t, quarantine, reload

SIGTERM / SIGINT — graceful shutdown
           in-flight symlink swaps finish; downloads abort cleanly`

const releasesSnippet = `data_dir/sites/<domain>/
  releases/
    20260601T120000-abc1234/    # <RFC3339-ts>-<git-ref|etag>
    20260601T120512-def5678/
    20260602T080000-ghi9012/    # newest successful sync
  current -> releases/20260602T080000-ghi9012   # atomic rename(2) swap

# keep_releases: 3 (default) — oldest release dirs pruned after each sync
# Failures back off as interval × 2^streak, capped at 4× interval;
# current is never touched on failure — last good content stays live.`

const dockerSnippet = `# nginx:alpine + the daemon in one container (linux/amd64 + linux/arm64)
docker run -d \\
  -p 80:80 -p 443:443 \\
  -v /etc/nginxpilot:/etc/nginxpilot:ro \\
  -v nginxpilot-sites:/var/lib/nginxpilot \\
  ghcr.io/kalevski/toolcase/nginxpilot:latest

# nginx and the daemon both run as the unprivileged nginxpilot user;
# managed-mode dirs live under /etc/nginx/nginxpilot/ and are baked into nginx.conf.
# php-fpm ships when built with PHP_VERSION (default 83); --build-arg PHP_VERSION="" drops it.

# Any argument runs the CLI instead of the supervisor:
docker run --rm -v /etc/nginxpilot:/etc/nginxpilot:ro \\
  ghcr.io/kalevski/toolcase/nginxpilot:latest validate`

const features = [
    {
        title: 'Atomic deploys',
        body: 'Content is staged, fsynced, then made live with a rename(2) symlink swap. nginx never serves a half-written directory; content updates need no nginx reload.',
    },
    {
        title: 'Last known-good wins',
        body: 'Any sync failure — network error, bad auth, corrupt archive — leaves the current release untouched. Retries back off exponentially, capped at 4× the interval.',
    },
    {
        title: 'Optional managed mode',
        body: 'Opt in and nginxpilot writes the live nginx config: TLS from a cert dir, certbot renewal, per-host toggles, L4 streams. A resource that fails nginx -t is quarantined, never fatal.',
    },
    {
        title: 'Sites, proxies, PHP apps',
        body: 'Static sites (static / spa / clean-urls), reverse proxies with upstream pools, redirects, parked hosts, and PHP apps on isolated per-app php-fpm pools with persistent paths.',
    },
    {
        title: 'Driven over REST',
        body: 'Every entity has GET/POST/DELETE endpoints that validate the merged candidate config before writing, so a control plane never hand-edits sites.d/.',
    },
    {
        title: 'Hardened by default',
        body: 'Zip-slip and symlink rejection, zip-bomb limits, inline secrets are a parse error, strict backend-target grammar, unprivileged daemon with a strict systemd unit.',
    },
]

export const NginxPilotPage = () => {
    return (
        <main className="site-container">
            <AppIntro
                name="nginxpilot"
                eyebrow="App · Daemon · Go"
                lead="A Go daemon that runs alongside nginx and keeps static sites and PHP apps in sync with git repositories or HTTP zip archives. By default it never touches nginx config; opt into managed mode and it writes and validates the live config too — TLS, reverse proxies, streams — without ever handing nginx a config that fails nginx -t."
                chips={['Go', 'git', 'http-zip', 'managed mode', 'TLS · ACME', 'PHP', 'Loki', 'Docker']}
                meta={[
                    { label: 'Language', value: 'Go 1.24' },
                    { label: 'Modes', value: 'generate · managed' },
                    { label: 'Dependencies', value: '2' },
                    { label: 'License', value: 'MIT' },
                ]}
            />

            <CodeSection
                title="How it works"
                count="pull → stage → atomic swap"
                file="architecture"
                code={archDiagram}
            />
            <FeatureGrid features={features} />

            <CodeSection
                title="Configuration"
                count="declarative YAML · strict unknown-key errors · sites.d/ fragments"
                file="config.yml"
                code={configExample}
            />
            <CodeSection
                title="git source"
                count="ssh-key · https-token · github-token · routing · cache_assets"
                file="sites.d/example.com.yml"
                code={gitSourceExample}
            />
            <CodeSection
                title="http-zip source"
                count="conditional GET · checksum · zip-bomb limits"
                file="sites.d/blog.example.com.yml"
                code={httpZipSourceExample}
            />
            <CodeSection
                title="Proxies, redirects, parked hosts"
                count="upstream pools · websockets · wildcards"
                file="sites.d/proxies.yml"
                code={proxiesExample}
            />
            <CodeSection
                title="Managed mode"
                count="writes the live config · TLS · renewal · per-host toggles · streams"
                file="config.yml"
                code={managedExample}
            />
            <CodeSection
                title="Crash-proof apply"
                count="never crash nginx"
                file="apply.txt"
                code={crashProofSnippet}
            />
            <CodeSection
                title="PHP apps"
                count="per-app php-fpm pools · persistent paths · isolation"
                file="sites.d/shop.example.com.yml"
                code={phpExample}
            />
            <CodeSection
                title="Log shipping"
                count="structured access logs · Loki / http / file / stdout"
                file="config.yml"
                code={logsExample}
            />
            <CodeSection
                title="Secrets"
                count="_env / _file refs only · 0600/0640 enforcement"
                file="secrets.yml"
                code={secretsExample}
            />
            <CodeSection title="CLI" count="single binary" file="cli-reference.sh" code={cliReference} />
            <CodeSection
                title="Admin API"
                count="loopback HTTP · status · REST config · certs"
                file="admin.sh"
                code={adminEndpoints}
            />
            <CodeSection
                title="Signals"
                count="SIGHUP diff-reload · SIGTERM/SIGINT graceful shutdown"
                file="signals.txt"
                code={signalsSnippet}
            />
            <CodeSection
                title="Releases & failure"
                count="keep_releases · atomic current symlink · capped backoff"
                file="releases.txt"
                code={releasesSnippet}
            />
            <CodeSection
                title="Docker"
                count="nginx + daemon in one image · or static binary + systemd"
                file="docker.sh"
                code={dockerSnippet}
            />

            <SectionHead title="Run it" count="binary, systemd or Docker" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="docker pull ghcr.io/kalevski/toolcase/nginxpilot:latest" />
                <CopyLine cmd="nginxpilot validate && nginxpilot sync example.com" />
            </div>

            <SourceCard dir="nginxpilot" tagline="Go module, README, systemd unit, Dockerfile" />
        </main>
    )
}
