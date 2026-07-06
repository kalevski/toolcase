import Link from 'next/link';

const ROOT_VARS = {
    '--accent': '#e0a458',
    '--accent2': '#e0a458',
    '--bg': '#0b0f14',
    '--bg2': '#0f151c',
    '--card': '#111a23',
    '--line': 'rgba(255,255,255,.08)',
    '--line2': 'rgba(255,255,255,.15)',
    '--tx': '#e8edf2',
    '--muted': '#9aa7b4',
    '--faint': '#647079',
} as React.CSSProperties;

const FEATURES = [
    {
        idx: '01',
        glyph: '⇧',
        title: 'Deploy static sites',
        desc: 'Pick a repo, a branch, a hostname. Quaykeeper pushes the config; nginxpilot fetches and serves. No CI pipeline, no artifacts.',
        tags: ['github', 'branches', 'custom domains'],
    },
    {
        idx: '02',
        glyph: '⇄',
        title: 'Manage all routing',
        desc: 'Proxies, L4 streams, redirects, dead hosts, and named access lists — every nginx edit as a validated form.',
        tags: ['proxy', 'stream', 'access lists'],
    },
    {
        idx: '03',
        glyph: '⛨',
        title: 'Certificates, no ceremony',
        desc: 'ACME via HTTP-01 or DNS-01, wildcards included. Upload your own, force-renew, store DNS creds write-only.',
        tags: ['acme', 'dns-01', 'wildcard'],
    },
    {
        idx: '04',
        glyph: '▤',
        title: 'Databases as a surface',
        desc: 'Register Postgres & MySQL once. Create databases and users, grant with presets or per-op control, guardrails on.',
        tags: ['postgres', 'mysql', 'grants'],
    },
    {
        idx: '05',
        glyph: '⚙',
        title: 'Centralized app config',
        desc: 'Env vars and feature flags per instance. Apps pull from the agent API with ETag caching and rotatable fetch keys.',
        tags: ['env', 'flags', 'agent api'],
    },
    {
        idx: '06',
        glyph: '⬡',
        title: 'Docker snippets',
        desc: 'Save your docker run recipes as structured, validated specs with a live command preview. Stop grepping history.',
        tags: ['run specs', 'preview'],
    },
    {
        idx: '07',
        glyph: '◷',
        title: 'Scheduled tasks',
        desc: 'Shell or Node scripts on 5-field cron or on demand. Every run captures stdout, stderr, exit code, duration.',
        tags: ['cron', 'on-demand', 'history'],
    },
    {
        idx: '08',
        glyph: '◈',
        title: 'Many servers, one console',
        desc: 'Each daemon is a realm — VPS, homelab, a client box. Switch from the header; every admin token encrypted at rest.',
        tags: ['realms', 'aes-256', 'audit log'],
    },
];

const PRINCIPLES = [
    { key: '[01]', title: 'Never in the request path', desc: 'Quaykeeper can be down; your sites keep serving. It only orchestrates.' },
    { key: '[02]', title: 'Secrets go one way', desc: 'Tokens, keys and passwords are accepted, encrypted or hashed, and never read back out.' },
    { key: '[03]', title: 'Fail closed', desc: 'Domain verification, webhook signatures, fragment validation — every gate defaults to no.' },
    { key: '[04]', title: 'Boring persistence', desc: 'One SQLite file with WAL and ordered migrations. Back it up with cp.' },
    { key: '[05]', title: 'Owner-gated power', desc: 'Anything touching the host — certs, tasks, realms — needs the highest role and is audited.' },
];

const PERSONAS = [
    { mark: '~/', who: 'Self-hosters', desc: 'One dashboard instead of five terminals, for the homelab you actually run.' },
    { mark: '</>', who: 'Indie developers', desc: 'Ship static sites and side projects straight to your own VPS.' },
    { mark: '##', who: 'Small teams', desc: 'Shared, audited control over a handful of servers — without adopting a PaaS.' },
    { mark: '★', who: 'Maintainers', desc: 'Offer branch-deploy hosting to your community, funded through GitHub Sponsors.' },
];

export default function LandingPage() {
    return (
        <div data-root="qk" style={{ ...ROOT_VARS, minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', position: 'relative', overflowX: 'hidden' }}>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.05) 1px, transparent 0)',
                    backgroundSize: '26px 26px',
                    maskImage: 'linear-gradient(180deg,rgba(0,0,0,.9),transparent 60%)',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    top: '-260px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '900px',
                    height: '520px',
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 16%, transparent), transparent 68%)',
                    filter: 'blur(20px)',
                }}
            />

            {/* NAV */}
            <header
                style={{
                    position: 'relative',
                    zIndex: 5,
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '22px 40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                    <div style={{ width: '26px', height: '26px', transform: 'rotate(45deg)', border: '2px solid var(--accent)', borderRadius: '5px', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '5px', background: 'var(--accent)', borderRadius: '2px', opacity: 0.35 }} />
                    </div>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '19px', letterSpacing: '-.01em' }}>Quaykeeper</span>
                </div>
                <nav style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}>
                    <a href="#features" className="qk-navlink">
                        Features
                    </a>
                    <a href="#architecture" className="qk-navlink">
                        Architecture
                    </a>
                    <a href="#principles" className="qk-navlink">
                        Principles
                    </a>
                    <Link href="/nginxpilot-guide/" className="qk-navlink">
                        nginxpilot guide
                    </Link>
                    <a href="#start" className="qk-navlink">
                        Get started
                    </a>
                </nav>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <a
                        href="#start"
                        className="qk-star-btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: '12.5px',
                            border: '1px solid var(--line)',
                            padding: '8px 13px',
                            borderRadius: '8px',
                        }}
                    >
                        <span style={{ color: 'var(--accent2)' }}>★</span> Star on GitHub
                    </a>
                    <a
                        href="#start"
                        className="qk-deploy-btn"
                        style={{ fontSize: '13.5px', fontWeight: 600, padding: '9px 16px', borderRadius: '8px' }}
                    >
                        Deploy
                    </a>
                </div>
            </header>

            {/* HERO */}
            <section
                style={{
                    position: 'relative',
                    zIndex: 2,
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '64px 40px 40px',
                    display: 'grid',
                    gridTemplateColumns: '1.05fr .95fr',
                    gap: '56px',
                    alignItems: 'center',
                }}
            >
                <div>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: '11.5px',
                            letterSpacing: '.12em',
                            color: 'var(--faint)',
                            textTransform: 'uppercase',
                            border: '1px solid var(--line)',
                            borderRadius: '999px',
                            padding: '6px 13px',
                            marginBottom: '26px',
                        }}
                    >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'qk-pulse 2.4s ease-in-out infinite' }} />
                        Self-hosted · Open source · Yours
                    </div>
                    <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '52px', lineHeight: 1.04, letterSpacing: '-.025em', margin: '0 0 22px' }}>
                        Your self-hosted
                        <br />
                        harbor for everything
                        <br />
                        that <span style={{ color: 'var(--accent)' }}>ships</span>.
                    </h1>
                    <p style={{ fontSize: '17.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '520px', margin: '0 0 34px' }}>
                        One control plane for static sites, reverse proxies, databases, TLS certificates, app config, and scheduled
                        operations — behind a single GitHub login, on infrastructure you own.
                    </p>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a
                            href="#start"
                            className="qk-cta-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '15px', fontWeight: 600, padding: '13px 22px', borderRadius: '10px' }}
                        >
                            Get started <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>→</span>
                        </a>
                        <a
                            href="#architecture"
                            className="qk-cta-secondary"
                            style={{ fontSize: '15px', fontWeight: 500, border: '1px solid var(--line2)', padding: '13px 22px', borderRadius: '10px' }}
                        >
                            See the architecture
                        </a>
                    </div>
                    <div style={{ display: 'flex', gap: '26px', marginTop: '40px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--faint)' }}>
                        <div>
                            <span style={{ color: 'var(--tx)', fontSize: '19px', fontWeight: 600, display: 'block', fontFamily: "'Space Grotesk',sans-serif" }}>1</span>
                            container
                        </div>
                        <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '26px' }}>
                            <span style={{ color: 'var(--tx)', fontSize: '19px', fontWeight: 600, display: 'block', fontFamily: "'Space Grotesk',sans-serif" }}>SQLite</span>
                            no external DB
                        </div>
                        <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '26px' }}>
                            <span style={{ color: 'var(--tx)', fontSize: '19px', fontWeight: 600, display: 'block', fontFamily: "'Space Grotesk',sans-serif" }}>0</span>
                            in request path
                        </div>
                    </div>
                </div>

                {/* ARCHITECTURE PANEL */}
                <div
                    style={{
                        border: '1px solid var(--line)',
                        borderRadius: '14px',
                        background: 'linear-gradient(180deg,var(--bg2),var(--card))',
                        boxShadow: '0 30px 80px -40px rgba(0,0,0,.9)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '11px 15px',
                            borderBottom: '1px solid var(--line)',
                            background: 'rgba(255,255,255,.02)',
                        }}
                    >
                        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ff5f57', opacity: 0.7 }} />
                        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#febc2e', opacity: 0.7 }} />
                        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28c840', opacity: 0.7 }} />
                        <span style={{ marginLeft: '8px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '11.5px', color: 'var(--faint)' }}>control-plane.map</span>
                    </div>
                    <div style={{ padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '12px',
                                    color: 'var(--muted)',
                                    border: '1px dashed var(--line2)',
                                    borderRadius: '9px',
                                    padding: '12px 8px',
                                }}
                            >
                                you
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>GitHub OAuth →</div>
                            <div
                                style={{
                                    flex: 1.3,
                                    textAlign: 'center',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#08110f',
                                    background: 'var(--accent)',
                                    borderRadius: '9px',
                                    padding: '12px 8px',
                                }}
                            >
                                Quaykeeper
                            </div>
                        </div>
                        <div
                            style={{
                                height: '20px',
                                marginLeft: 'calc(50% + 12px)',
                                width: '2px',
                                background: 'repeating-linear-gradient(180deg,var(--line2) 0 5px,transparent 5px 10px)',
                            }}
                        />
                        <div
                            style={{
                                border: '1px solid var(--line)',
                                borderRadius: '11px',
                                background: 'rgba(255,255,255,.02)',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '11px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--faint)' }}>admin REST →</div>
                                <div
                                    style={{
                                        fontFamily: "'IBM Plex Mono',monospace",
                                        fontSize: '12px',
                                        color: 'var(--tx)',
                                        border: '1px solid var(--line2)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                    }}
                                >
                                    nginxpilot
                                </div>
                            </div>
                            <div style={{ height: '1px', background: 'var(--line)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--faint)' }}>serves →</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'qk-pulse 2.4s ease-in-out infinite' }} />
                                    nginx · your traffic
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                            <div
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '11px',
                                    color: 'var(--muted)',
                                    border: '1px solid var(--line)',
                                    borderRadius: '8px',
                                    padding: '9px 6px',
                                }}
                            >
                                Postgres / MySQL
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '11px',
                                    color: 'var(--muted)',
                                    border: '1px solid var(--line)',
                                    borderRadius: '8px',
                                    padding: '9px 6px',
                                }}
                            >
                                your apps
                            </div>
                        </div>
                    </div>
                    <div
                        style={{
                            borderTop: '1px solid var(--line)',
                            padding: '12px 16px',
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: '11px',
                            color: 'var(--faint)',
                            background: 'rgba(255,255,255,.02)',
                        }}
                    >
                        <span style={{ color: 'var(--accent2)' }}>◆</span> never in the request path — it orchestrates, then gets out of the way
                    </div>
                </div>
            </section>

            {/* PROBLEM STRIP */}
            <section style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '56px auto 0', padding: '0 40px' }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: '16px', background: 'var(--bg2)', padding: '36px 38px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '24px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// the problem</span>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '24px', letterSpacing: '-.02em', margin: 0 }}>
                            One small setup, five open terminals.
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '18px 30px' }}>
                        {[
                            { n: '01', text: <>Deploying a static site means SSH, <span style={{ color: 'var(--tx)' }}>git pull</span>, rsync scripts, hand-edited nginx configs.</> },
                            { n: '02', text: <>A redirect means touching <span style={{ color: 'var(--tx)' }}>conf.d/</span> and praying <span style={{ color: 'var(--tx)' }}>nginx -t</span> passes.</> },
                            { n: '03', text: <>TLS certs are certbot cron jobs you set up once and hope never break.</> },
                            { n: '04', text: <>A new DB user means <span style={{ color: 'var(--tx)' }}>psql</span> as root, typing GRANT from memory.</> },
                            { n: '05', text: <><span style={{ color: 'var(--tx)' }}>.env</span> files scattered across machines, no history, no source of truth.</> },
                            { n: '06', text: <>Maintenance scripts buried in crontabs nobody remembers editing.</> },
                        ].map((row) => (
                            <div key={row.n} style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: 'var(--faint)', fontSize: '12px' }}>{row.n}</span>
                                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--muted)' }}>{row.text}</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ margin: '26px 0 0', fontSize: '15px', color: 'var(--tx)' }}>
                        Each is simple alone. Together they turn a small setup into a part-time job — and every manual step is a typo
                        away from breaking production. <span style={{ color: 'var(--accent)' }}>Quaykeeper replaces all of it with one console.</span>
                    </p>
                </div>
            </section>

            {/* FEATURES */}
            <section id="features" style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '100px auto 0', padding: '0 40px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '34px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// what you can do</span>
                    <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '32px', letterSpacing: '-.025em', margin: 0 }}>
                        Everything you&apos;d hand-edit, as forms with instant validation.
                    </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
                    {FEATURES.map((f) => (
                        <div
                            key={f.idx}
                            className="qk-feature-card"
                            style={{
                                border: '1px solid var(--line)',
                                borderRadius: '13px',
                                padding: '20px 19px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '11px',
                                minHeight: '196px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: 'var(--faint)' }}>{f.idx}</span>
                                <span style={{ fontSize: '16px', color: 'var(--accent)' }}>{f.glyph}</span>
                            </div>
                            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '16.5px', margin: 0, letterSpacing: '-.01em' }}>{f.title}</h3>
                            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--muted)', flex: 1 }}>{f.desc}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {f.tags.map((t) => (
                                    <span
                                        key={t}
                                        style={{
                                            fontFamily: "'IBM Plex Mono',monospace",
                                            fontSize: '10px',
                                            color: 'var(--faint)',
                                            border: '1px solid var(--line)',
                                            borderRadius: '5px',
                                            padding: '2px 6px',
                                        }}
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ARCHITECTURE + PRINCIPLES */}
            <section id="architecture" style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '100px auto 0', padding: '0 40px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '44px', alignItems: 'start' }}>
                    <div>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// how it&apos;s built</span>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '30px', letterSpacing: '-.025em', margin: '12px 0 18px' }}>
                            The policy &amp; UI layer for infra you already run.
                        </h2>
                        <p style={{ fontSize: '15.5px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 16px' }}>
                            Quaykeeper sits <em style={{ color: 'var(--tx)', fontStyle: 'normal' }}>next to</em> your infrastructure, never
                            inside it. It drives nginxpilot over a REST API and talks to your databases directly — it never touches the
                            web server&apos;s filesystem. State lives in a single SQLite file: no external database, no message queue,
                            no Kubernetes.
                        </p>
                        <p style={{ fontSize: '15.5px', lineHeight: 1.65, color: 'var(--muted)', margin: 0 }}>
                            Deliberately small, deliberately inspectable, deliberately yours.
                        </p>
                    </div>
                    <div
                        id="principles"
                        style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: '14px', background: 'var(--bg2)', overflow: 'hidden' }}
                    >
                        {PRINCIPLES.map((p) => (
                            <div key={p.key} style={{ display: 'flex', gap: '16px', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: 'var(--accent)', whiteSpace: 'nowrap', paddingTop: '2px' }}>{p.key}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '3px' }}>{p.title}</div>
                                    <div style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--muted)' }}>{p.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PERSONAS */}
            <section style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '100px auto 0', padding: '0 40px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '30px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// who it&apos;s for</span>
                    <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '28px', letterSpacing: '-.025em', margin: 0 }}>
                        Built for the people who run their own boxes.
                    </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
                    {PERSONAS.map((p) => (
                        <div key={p.who} style={{ border: '1px solid var(--line)', borderRadius: '13px', padding: '22px 20px', background: 'linear-gradient(180deg,var(--bg2),transparent)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '20px', color: 'var(--accent2)', marginBottom: '14px' }}>{p.mark}</div>
                            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '16px', margin: '0 0 8px' }}>{p.who}</h3>
                            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: 'var(--muted)' }}>{p.desc}</p>
                        </div>
                    ))}
                </div>
                <p style={{ margin: '26px 0 0', fontSize: '14px', color: 'var(--faint)', textAlign: 'center' }}>
                    Not a PaaS. Not a Kubernetes replacement. Not a build farm.{' '}
                    <span style={{ color: 'var(--muted)' }}>The control layer for infrastructure that&apos;s already yours.</span>
                </p>
            </section>

            {/* GET STARTED */}
            <section id="start" style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '100px auto 0', padding: '0 40px' }}>
                <div
                    style={{
                        border: '1px solid var(--line)',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg,var(--bg2),var(--card))',
                        overflow: 'hidden',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.15fr',
                    }}
                >
                    <div style={{ padding: '44px 42px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// get started</span>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '30px', letterSpacing: '-.025em', margin: '12px 0 16px' }}>
                            One container. One volume. You&apos;re the owner.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--muted)', margin: '0 0 28px' }}>
                            Point it at a GitHub OAuth app and an nginxpilot daemon, sign in, and the first login becomes the owner. Back
                            it up with <span style={{ color: 'var(--tx)', fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px' }}>cp</span>.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <a href="#start" className="qk-cta-primary" style={{ fontSize: '15px', fontWeight: 600, padding: '12px 22px', borderRadius: '10px' }}>
                                Read the docs
                            </a>
                            <a href="#start" className="qk-cta-secondary" style={{ fontSize: '15px', fontWeight: 500, border: '1px solid var(--line2)', padding: '12px 22px', borderRadius: '10px' }}>
                                View on GitHub
                            </a>
                        </div>
                    </div>
                    <div
                        style={{
                            borderLeft: '1px solid var(--line)',
                            background: '#080b0f',
                            padding: '26px 28px',
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: '12.5px',
                            lineHeight: 1.9,
                            color: 'var(--muted)',
                            overflowX: 'auto',
                        }}
                    >
                        <div style={{ color: 'var(--faint)' }}># pull the images</div>
                        <div>
                            <span style={{ color: 'var(--accent2)' }}>docker</span> pull ghcr.io/kalevski/toolcase/nginxpilot:latest
                        </div>
                        <div>
                            <span style={{ color: 'var(--accent2)' }}>docker</span> pull ghcr.io/kalevski/toolcase/quaykeeper:latest
                        </div>
                        <div style={{ height: '12px' }} />
                        <div style={{ color: 'var(--faint)' }}># run it beside nginxpilot</div>
                        <div>
                            <span style={{ color: 'var(--accent2)' }}>docker</span> run -d --name quaykeeper \
                        </div>
                        <div style={{ paddingLeft: '20px' }}>--network nginxpilot-net \</div>
                        <div style={{ paddingLeft: '20px' }}>-p 4100:3000 -p 4101:4101 \</div>
                        <div style={{ paddingLeft: '20px' }}>--env-file quaykeeper/.env \</div>
                        <div style={{ paddingLeft: '20px' }}>-v &quot;$HOME/quaykeeper-workspace:/workspace&quot; \</div>
                        <div style={{ paddingLeft: '20px' }}>ghcr.io/kalevski/toolcase/quaykeeper:latest</div>
                        <div style={{ height: '12px' }} />
                        <div style={{ color: 'var(--accent)' }}>✓ signed in — you&apos;re the owner</div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer
                style={{
                    position: 'relative',
                    zIndex: 2,
                    maxWidth: '1200px',
                    margin: '90px auto 0',
                    padding: '34px 40px 50px',
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '20px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                    <div style={{ width: '20px', height: '20px', transform: 'rotate(45deg)', border: '2px solid var(--accent)', borderRadius: '4px' }} />
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '16px' }}>Quaykeeper</span>
                    <span style={{ color: 'var(--faint)', fontSize: '14px', marginLeft: '6px' }}>keep the quay, ship the fleet.</span>
                </div>
                <div style={{ display: 'flex', gap: '26px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    <a href="#features" className="qk-navlink">
                        Features
                    </a>
                    <a href="#architecture" className="qk-navlink">
                        Architecture
                    </a>
                    <Link href="/nginxpilot-guide/" className="qk-navlink">
                        Guide
                    </Link>
                    <a href="#start" className="qk-navlink">
                        Docs
                    </a>
                    <a href="#start" className="qk-navlink">
                        GitHub
                    </a>
                </div>
            </footer>
        </div>
    );
}
