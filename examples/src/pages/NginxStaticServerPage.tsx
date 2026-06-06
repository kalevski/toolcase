import { Link as RouterLink } from 'react-router'
import { CodeBlock, CopyLine } from './_chrome'

const archDiagram = `git remotes / zip endpoints ──fetch──► nginx-static-server ──writes──► data_dir/sites/<domain>/
                                                                        releases/<ts>-<ref>/
                                                                        current -> releases/...  (atomic symlink)
                                                                                 ▲
                                                 nginx  root = .../current ─────┘`

const configExample = `# /etc/nginx-static-server/config.yml — globals + includes
data_dir: /var/lib/nginx-static-server
admin:
  listen: 127.0.0.1:9090          # health + status + manual sync trigger
defaults:
  interval: 5m
  keep_releases: 3
include:
  - sites.d/*.yml                 # drop a file in, kill -HUP — that's onboarding

# /etc/nginx-static-server/sites.d/example.com.yml
sites:
  - domain: example.com
    source:
      type: git                   # or: http-zip (CI artifact URL)
      url: git@github.com:acme/example-site.git
      branch: gh-pages
      auth:
        method: ssh-key
        key_file: /etc/nginx-static-server/keys/example_ed25519`

const cliReference = `nginx-static-server run                  # the daemon (default)
nginx-static-server validate             # parse + validate merged config, CI exit codes
nginx-static-server sync <domain>        # one-shot sync, no daemon needed (onboarding)
nginx-static-server print-vhost <domain> # nginx server-block starting snippet
nginx-static-server status [--json]      # per-site table from the daemon
nginx-static-server version              # build info`

const nginxSnippet = `server {
    listen 80;
    server_name example.com;

    # swapped atomically via rename(2) — no nginx reload on content updates
    root /var/lib/nginx-static-server/sites/example.com/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`

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

export const NginxStaticServerPage = () => {
    return (
        <main className="site-container">
            <div className="breadcrumbs">
                <RouterLink to="/apps">Apps</RouterLink>
                <span className="sep">/</span>
                <span className="current mono">nginx-static-server</span>
            </div>

            <section className="page-intro">
                <div>
                    <div className="eyebrow">App · Daemon · Go</div>
                    <h1 className="page-title mono">nginx-static-server</h1>
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
                <span className="count">declarative YAML + sites.d/ fragments</span>
            </div>
            <CodeBlock file="config.yml" code={configExample} />

            <div className="section-head">
                <h2>CLI</h2>
                <span className="count">single binary</span>
            </div>
            <CodeBlock file="cli-reference.sh" code={cliReference} />

            <div className="section-head">
                <h2>nginx integration</h2>
                <span className="count">the daemon never touches nginx config</span>
            </div>
            <CodeBlock file="example.com.conf" code={nginxSnippet} />

            <div className="section-head">
                <h2>Run it</h2>
                <span className="count">binary, systemd or Docker</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="docker pull ghcr.io/kalevski/nginx-static-server:latest" />
                <CopyLine cmd="nginx-static-server validate && nginx-static-server sync example.com" />
            </div>

            <div className="section-head">
                <h2>Source</h2>
                <span className="count">lives in the toolcase monorepo</span>
            </div>
            <div className="lib-grid">
                <a
                    href="https://github.com/kalevski/toolcase/tree/main/nginx-static-server"
                    target="_blank"
                    rel="noreferrer"
                    className="lib-card"
                >
                    <div className="lib-card-head">
                        <div>
                            <h3 className="lib-name">kalevski/toolcase</h3>
                            <p className="lib-tagline">nginx-static-server/ — Go module, README, systemd unit, Dockerfile</p>
                        </div>
                        <span className="lib-arrow">→</span>
                    </div>
                </a>
            </div>
        </main>
    )
}
