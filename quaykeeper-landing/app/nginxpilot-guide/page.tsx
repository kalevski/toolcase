import Link from 'next/link';

const ROOT_VARS = {
    '--accent': '#e0a458',
    '--accent2': '#45c8bf',
    '--bg': '#0b0f14',
    '--bg2': '#0f151c',
    '--card': '#111a23',
    '--line': 'rgba(255,255,255,.08)',
    '--line2': 'rgba(255,255,255,.15)',
    '--tx': '#e8edf2',
    '--muted': '#9aa7b4',
    '--faint': '#647079',
} as React.CSSProperties;

const TOC = [
    { n: '01', label: 'What it is', href: '#what' },
    { n: '02', label: 'How it fits', href: '#fit' },
    { n: '03', label: 'Install & run', href: '#install' },
    { n: '04', label: 'The admin API', href: '#api' },
    { n: '05', label: 'Validation', href: '#validate' },
    { n: '06', label: 'TLS', href: '#tls' },
    { n: '07', label: 'Connect', href: '#connect' },
];

const TRAITS = [
    { glyph: '⊟', title: 'Owns the mutable config', desc: 'Server blocks, upstreams, redirects and TLS — not your hand-written base.' },
    { glyph: '⇌', title: 'Declarative in, nginx out', desc: 'You describe intent; it renders and validates the actual config.' },
    { glyph: '◉', title: 'In the request path', desc: 'This is the piece that actually serves traffic. Quaykeeper is not.' },
];

const ENDPOINTS = [
    { method: 'GET', color: '#45c8bf', path: '/admin/health', desc: 'Liveness, nginx version, config hash.' },
    { method: 'POST', color: '#9ece6a', path: '/admin/sites', desc: 'Deploy a static site from a git ref.' },
    { method: 'POST', color: '#9ece6a', path: '/admin/proxies', desc: 'Create a reverse-proxy host + upstream pool.' },
    { method: 'POST', color: '#9ece6a', path: '/admin/streams', desc: 'L4 TCP/UDP forward, optional TLS termination.' },
    { method: 'POST', color: '#9ece6a', path: '/admin/certs/issue', desc: 'Run ACME (HTTP-01 or DNS-01) for a hostname.' },
    { method: 'DELETE', color: '#ff6b6b', path: '/admin/hosts/:id', desc: 'Retire a host and reclaim its config.' },
];

const PIPELINE = [
    { n: '1', title: 'Render', desc: 'The API request is turned into a config fragment from vetted templates — no raw config is ever accepted.' },
    { n: '2', title: 'Test the whole tree', desc: 'The daemon runs nginx -t against the complete running config, not just the fragment, catching cross-block conflicts.' },
    { n: '3', title: 'Apply atomically', desc: 'Only on a clean test are files written and the change committed. A failed test leaves the old config untouched.' },
    { n: '4', title: 'Graceful reload', desc: 'nginx -s reload picks up the change with zero dropped connections.' },
];

const TLS = [
    { tag: '[01]', title: 'ACME issuance', desc: 'HTTP-01 for single hosts, DNS-01 for wildcards, via certbot under the hood.' },
    { tag: '[02]', title: 'Bring your own', desc: 'Upload a cert/key pair directly; the key is write-only and never read back.' },
    { tag: '[03]', title: 'Auto-renewal', desc: 'The daemon tracks expiry and renews ahead of time, reloading on success.' },
    { tag: '[04]', title: 'DNS credentials', desc: 'Per-provider tokens (Cloudflare, Route 53, DigitalOcean…) stored encrypted.' },
];

const CONNECT = [
    { n: '1', text: 'In Quaykeeper, open Settings → Realms → Add realm.' },
    { n: '2', text: 'Give it a name and the internal URL of the daemon (e.g. http://nginxpilot:8090).' },
    { n: '3', text: 'Paste the ADMIN_TOKEN from install. It is encrypted immediately and never displayed again.' },
    { n: '4', text: 'Quaykeeper handshakes, reads nginx’s version and current hosts, and the realm goes live.' },
];

export default function NginxpilotGuidePage() {
    return (
        <div data-root="np" style={{ ...ROOT_VARS, minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', position: 'relative' }}>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.045) 1px, transparent 0)',
                    backgroundSize: '26px 26px',
                    maskImage: 'linear-gradient(180deg,rgba(0,0,0,.8),transparent 40%)',
                }}
            />

            {/* NAV */}
            <header
                style={{
                    position: 'relative',
                    zIndex: 5,
                    maxWidth: '1180px',
                    margin: '0 auto',
                    padding: '22px 40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--line)',
                }}
            >
                <Link href="/" className="qk-navlink" style={{ display: 'flex', alignItems: 'center', gap: '11px', color: 'var(--tx)' }}>
                    <div style={{ width: '24px', height: '24px', transform: 'rotate(45deg)', border: '2px solid var(--accent2)', borderRadius: '5px' }} />
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '18px', letterSpacing: '-.01em' }}>Quaykeeper</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: 'var(--faint)', borderLeft: '1px solid var(--line)', paddingLeft: '11px', marginLeft: '3px' }}>
                        docs / nginxpilot
                    </span>
                </Link>
                <Link href="/" className="qk-navlink" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    ← back to overview
                </Link>
            </header>

            {/* HERO */}
            <section style={{ position: 'relative', zIndex: 2, maxWidth: '1180px', margin: '0 auto', padding: '52px 40px 30px' }}>
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '9px',
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: '11px',
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        border: '1px solid var(--line)',
                        borderRadius: '999px',
                        padding: '5px 12px',
                        marginBottom: '22px',
                    }}
                >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'np-pulse 2.4s ease-in-out infinite' }} /> Guide · the
                    daemon in the request path
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '44px', lineHeight: 1.05, letterSpacing: '-.025em', margin: '0 0 18px', maxWidth: '820px' }}>
                    nginxpilot — the sync daemon that lives beside nginx.
                </h1>
                <p style={{ fontSize: '17px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '680px', margin: 0 }}>
                    Quaykeeper is the console; <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>nginxpilot is the hands.</strong> It
                    runs on the same host as nginx, exposes an admin REST API, and turns declarative requests into validated config — so
                    Quaykeeper never has to touch the web server&apos;s filesystem.
                </p>
            </section>

            {/* BODY: SIDEBAR + CONTENT */}
            <div style={{ position: 'relative', zIndex: 2, maxWidth: '1180px', margin: '0 auto', padding: '20px 40px 90px', display: 'grid', gridTemplateColumns: '210px 1fr', gap: '52px', alignItems: 'start' }}>
                {/* TOC */}
                <aside style={{ position: 'sticky', top: '26px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '12px' }}>
                        On this page
                    </div>
                    {TOC.map((t) => (
                        <a key={t.n} href={t.href} className="qk-toc-link" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px', padding: '6px 0', display: 'flex', gap: '9px' }}>
                            <span style={{ color: 'var(--faint)' }}>{t.n}</span>
                            {t.label}
                        </a>
                    ))}
                    <div style={{ marginTop: '20px', border: '1px solid var(--line)', borderRadius: '11px', background: 'var(--bg2)', padding: '15px 16px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginBottom: '7px' }}>RELATIONSHIP</div>
                        <div style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--muted)' }}>
                            nginxpilot serves traffic. Quaykeeper only orchestrates it. Either can restart without the other losing state.
                        </div>
                    </div>
                </aside>

                {/* CONTENT */}
                <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '56px' }}>
                    {/* 01 WHAT IT IS */}
                    <section id="what" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>01 · What it is</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            A thin control surface over a real nginx.
                        </h2>
                        <p style={{ fontSize: '15.5px', lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 16px', maxWidth: '720px' }}>
                            nginxpilot is a small daemon that runs next to (or inside the same container as) your nginx. It owns the parts
                            of the config that change often — server blocks, upstreams, redirects, TLS — and leaves your hand-written base
                            config alone. Every change arrives as a structured API call, is validated against the{' '}
                            <em style={{ color: 'var(--tx)', fontStyle: 'normal' }}>full running config</em>, and is only applied if nginx
                            would accept it.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '22px' }}>
                            {TRAITS.map((tr) => (
                                <div key={tr.title} style={{ border: '1px solid var(--line)', borderRadius: '11px', background: 'var(--card)', padding: '16px 17px' }}>
                                    <div style={{ fontSize: '16px', color: 'var(--accent2)', marginBottom: '9px' }}>{tr.glyph}</div>
                                    <div style={{ fontWeight: 600, fontSize: '14.5px', marginBottom: '5px' }}>{tr.title}</div>
                                    <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--muted)' }}>{tr.desc}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 02 HOW IT FITS */}
                    <section id="fit" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>02 · How it fits</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            One side serves; the other decides.
                        </h2>
                        <div
                            style={{
                                border: '1px solid var(--line)',
                                borderRadius: '14px',
                                background: 'var(--bg2)',
                                padding: '26px',
                                display: 'grid',
                                gridTemplateColumns: '1fr auto 1fr auto 1fr',
                                alignItems: 'center',
                                gap: '14px',
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', fontWeight: 600, color: 'var(--tx)', border: '1px solid var(--line2)', borderRadius: '10px', padding: '16px 10px' }}>
                                    Quaykeeper
                                </div>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginTop: '8px' }}>control plane</div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--accent)', textAlign: 'center', lineHeight: 1.4 }}>
                                admin
                                <br />
                                REST →
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', fontWeight: 600, color: '#08110f', background: 'var(--accent)', borderRadius: '10px', padding: '16px 10px' }}>
                                    nginxpilot
                                </div>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginTop: '8px' }}>sync daemon</div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--accent2)', textAlign: 'center', lineHeight: 1.4 }}>
                                writes +
                                <br />
                                reloads →
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', fontWeight: 600, color: 'var(--accent2)', border: '1px solid var(--accent2)', borderRadius: '10px', padding: '16px 10px' }}>
                                    nginx
                                </div>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginTop: '8px' }}>your traffic</div>
                            </div>
                        </div>
                        <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--muted)', margin: '16px 0 0', maxWidth: '720px' }}>
                            The two only need to share a network. Quaykeeper holds an admin token for each nginxpilot it manages (each is a{' '}
                            <em style={{ color: 'var(--tx)', fontStyle: 'normal' }}>realm</em>) and speaks to it over HTTP. nginxpilot holds
                            no long-term state of its own beyond what nginx needs — the source of truth stays in Quaykeeper.
                        </p>
                    </section>

                    {/* 03 INSTALL */}
                    <section id="install" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>03 · Install &amp; run</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Bring it up on the nginx host.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 18px', maxWidth: '720px' }}>
                            Run nginxpilot on a shared Docker network so Quaykeeper can reach it. Expose the admin port only on that
                            internal network — never publish it to the internet.
                        </p>
                        <div
                            style={{
                                border: '1px solid var(--line)',
                                borderRadius: '12px',
                                background: '#080b0f',
                                padding: '22px 24px',
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: '12.5px',
                                lineHeight: 1.9,
                                color: 'var(--muted)',
                                overflowX: 'auto',
                            }}
                        >
                            <div style={{ color: 'var(--faint)' }}># pull the image</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>docker</span> pull ghcr.io/kalevski/toolcase/nginxpilot:latest
                            </div>
                            <div style={{ height: '12px' }} />
                            <div style={{ color: 'var(--faint)' }}># shared network for the two containers</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>docker</span> network create nginxpilot-net
                            </div>
                            <div style={{ height: '12px' }} />
                            <div style={{ color: 'var(--faint)' }}># run the daemon beside nginx</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>docker</span> run -d --name nginxpilot \
                            </div>
                            <div style={{ paddingLeft: '20px' }}>--network nginxpilot-net \</div>
                            <div style={{ paddingLeft: '20px' }}>-p 80:80 -p 443:443 \</div>
                            <div style={{ paddingLeft: '20px' }}>-e ADMIN_TOKEN=&quot;$(openssl rand -hex 32)&quot; \</div>
                            <div style={{ paddingLeft: '20px' }}>-v nginxpilot-data:/data \</div>
                            <div style={{ paddingLeft: '20px' }}>ghcr.io/kalevski/toolcase/nginxpilot:latest</div>
                            <div style={{ height: '12px' }} />
                            <div style={{ color: 'var(--accent2)' }}>✓ admin API listening on nginxpilot-net:8090</div>
                        </div>
                        <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--faint)', margin: '12px 0 0', maxWidth: '720px' }}>
                            <span style={{ color: 'var(--accent2)' }}>
                                Keep the <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>ADMIN_TOKEN</span>.
                            </span>{' '}
                            You paste it into Quaykeeper once, where it is encrypted at rest (AES-256-GCM) and never shown again.
                        </p>
                    </section>

                    {/* 04 ADMIN API */}
                    <section id="api" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>04 · The admin API</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Every object is a REST resource.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 20px', maxWidth: '720px' }}>
                            Auth is a single bearer token per daemon. Resources map one-to-one to the things you&apos;d otherwise write
                            into nginx by hand. Quaykeeper drives all of these for you — but they&apos;re a plain API you can{' '}
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', color: 'var(--tx)' }}>curl</span> for
                            debugging.
                        </p>
                        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '88px 1fr 1.2fr',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '11px',
                                    color: 'var(--faint)',
                                    background: 'var(--bg2)',
                                    padding: '10px 18px',
                                    borderBottom: '1px solid var(--line)',
                                    letterSpacing: '.06em',
                                }}
                            >
                                <div>METHOD</div>
                                <div>ENDPOINT</div>
                                <div>WHAT IT DOES</div>
                            </div>
                            {ENDPOINTS.map((e) => (
                                <div
                                    key={e.path}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '88px 1fr 1.2fr',
                                        gap: '10px',
                                        alignItems: 'center',
                                        fontFamily: "'IBM Plex Mono',monospace",
                                        fontSize: '12.5px',
                                        padding: '11px 18px',
                                        borderBottom: '1px solid var(--line)',
                                    }}
                                >
                                    <div style={{ color: e.color, fontWeight: 600 }}>{e.method}</div>
                                    <div style={{ color: 'var(--tx)' }}>{e.path}</div>
                                    <div style={{ color: 'var(--muted)', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '12.5px' }}>{e.desc}</div>
                                </div>
                            ))}
                        </div>
                        <div
                            style={{
                                border: '1px solid var(--line)',
                                borderRadius: '12px',
                                background: '#080b0f',
                                padding: '20px 24px',
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: '12.5px',
                                lineHeight: 1.85,
                                color: 'var(--muted)',
                                overflowX: 'auto',
                                marginTop: '16px',
                            }}
                        >
                            <div style={{ color: 'var(--faint)' }}># create a reverse proxy host</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>curl</span> -X POST https://nginxpilot:8090/admin/proxies \
                            </div>
                            <div style={{ paddingLeft: '20px' }}>-H &quot;Authorization: Bearer $ADMIN_TOKEN&quot; \</div>
                            <div style={{ paddingLeft: '20px' }}>-H &quot;Content-Type: application/json&quot; \</div>
                            <div style={{ paddingLeft: '20px' }}>-d &apos;{'{ "host": "app.example.com", "upstream": "127.0.0.1:3000" }'}&apos;</div>
                            <div style={{ height: '10px' }} />
                            <div style={{ color: 'var(--accent2)' }}>201 Created  ·  {'{ "id": "px_7f3a", "state": "active" }'}</div>
                        </div>
                    </section>

                    {/* 05 VALIDATION */}
                    <section id="validate" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>05 · Validation &amp; reloads</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            A bad fragment is a rejected request, never a broken nginx.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 20px', maxWidth: '720px' }}>
                            Every mutation runs the same gauntlet before it touches the live server. If any step fails, nothing changes
                            and the API returns the exact error.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: '12px', background: 'var(--bg2)', overflow: 'hidden' }}>
                            {PIPELINE.map((s) => (
                                <div key={s.n} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                                    <span
                                        style={{
                                            fontFamily: "'IBM Plex Mono',monospace",
                                            fontSize: '12px',
                                            color: '#08110f',
                                            background: 'var(--accent)',
                                            borderRadius: '6px',
                                            minWidth: '26px',
                                            height: '26px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {s.n}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14.5px', marginBottom: '3px' }}>{s.title}</div>
                                        <div style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--muted)' }}>{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', margin: '16px 0 0', maxWidth: '720px' }}>
                            Reloads are graceful (<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px', color: 'var(--tx)' }}>nginx -s reload</span>) — in-flight
                            connections are never dropped. Wildcard-covered subdomains need no reload at all.
                        </p>
                    </section>

                    {/* 06 TLS */}
                    <section id="tls" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>06 · TLS certificates</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Issuance and renewal, handled daemon-side.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 18px', maxWidth: '720px' }}>
                            nginxpilot runs the ACME flow itself, installs the vhost, and schedules renewal. Quaykeeper tells it{' '}
                            <em style={{ color: 'var(--tx)', fontStyle: 'normal' }}>what</em> to secure; nginxpilot does the challenge
                            dance and the file writes.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {TLS.map((c) => (
                                <div key={c.tag} style={{ border: '1px solid var(--line)', borderRadius: '11px', background: 'var(--card)', padding: '16px 18px', display: 'flex', gap: '13px' }}>
                                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: 'var(--accent)', paddingTop: '1px' }}>{c.tag}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{c.title}</div>
                                        <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--muted)' }}>{c.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 07 CONNECT */}
                    <section id="connect" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>07 · Connect it to Quaykeeper</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Register the daemon as a realm.
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {CONNECT.map((c) => (
                                    <div key={c.n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                        <span
                                            style={{
                                                fontFamily: "'IBM Plex Mono',monospace",
                                                fontSize: '12px',
                                                color: '#08110f',
                                                background: 'var(--accent2)',
                                                borderRadius: '6px',
                                                minWidth: '24px',
                                                height: '24px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {c.n}
                                        </span>
                                        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'var(--muted)' }}>{c.text}</p>
                                    </div>
                                ))}
                            </div>
                            <div
                                style={{
                                    border: '1px solid var(--line)',
                                    borderRadius: '12px',
                                    background: '#080b0f',
                                    padding: '20px 22px',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '12px',
                                    lineHeight: 1.85,
                                    color: 'var(--muted)',
                                }}
                            >
                                <div style={{ color: 'var(--faint)' }}># Quaykeeper → Settings → Realms</div>
                                <div style={{ height: '8px' }} />
                                <div>
                                    name&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--tx)' }}>homelab-01</span>
                                </div>
                                <div>
                                    url&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--tx)' }}>http://nginxpilot:8090</span>
                                </div>
                                <div>
                                    token&nbsp;&nbsp;<span style={{ color: 'var(--tx)' }}>••••••••••••••••</span> <span style={{ color: 'var(--faint)' }}>(write-only)</span>
                                </div>
                                <div style={{ height: '12px' }} />
                                <div style={{ color: 'var(--accent2)' }}>✓ handshake ok · 0 hosts · nginx 1.27</div>
                            </div>
                        </div>
                    </section>

                    {/* CALLOUT */}
                    <section
                        style={{
                            border: '1px solid var(--line)',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg,var(--bg2),var(--card))',
                            padding: '30px 34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '24px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <div>
                            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '20px', margin: '0 0 6px' }}>That&apos;s the whole daemon.</h3>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', maxWidth: '520px' }}>
                                Once nginxpilot is running and registered, everything else happens from the Quaykeeper console —
                                deploys, routing, certs, and databases.
                            </p>
                        </div>
                        <Link href="/#start" className="qk-guide-cta" style={{ fontSize: '14.5px', fontWeight: 600, padding: '12px 20px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                            Back to Quaykeeper →
                        </Link>
                    </section>
                </main>
            </div>

            {/* FOOTER */}
            <footer
                style={{
                    position: 'relative',
                    zIndex: 2,
                    maxWidth: '1180px',
                    margin: '0 auto',
                    padding: '28px 40px 46px',
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}
            >
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px', color: 'var(--faint)' }}>nginxpilot · the daemon beside nginx</span>
                <Link href="/" className="qk-navlink" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    Quaykeeper overview →
                </Link>
            </footer>
        </div>
    );
}
