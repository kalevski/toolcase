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

const TOC = [
    { n: '01', label: 'What it is', href: '#what' },
    { n: '02', label: 'How it fits', href: '#fit' },
    { n: '03', label: 'Install & run', href: '#install' },
    { n: '04', label: 'Sign in & roles', href: '#roles' },
    { n: '05', label: 'What you manage', href: '#surfaces' },
    { n: '06', label: 'Security model', href: '#principles' },
    { n: '07', label: 'Connect nginxpilot', href: '#connect' },
];

const TRAITS = [
    { glyph: '⌂', title: 'The one thing you open', desc: 'A single GitHub-login console for every server, site and database you run.' },
    { glyph: '◇', title: 'Never in the request path', desc: 'It orchestrates nginxpilot and your databases — traffic never flows through it.' },
    { glyph: '▣', title: 'One SQLite file', desc: 'No external database, no message queue. State lives in one file you can cp.' },
];

const SURFACES = [
    { idx: '01', title: 'Static sites', desc: 'Pick a repo, a branch, a hostname. Quaykeeper writes the deploy config; nginxpilot fetches and serves it.' },
    { idx: '02', title: 'Routing', desc: 'Proxies, L4 streams, redirects and access lists — every nginx edit as a validated form sent to nginxpilot.' },
    { idx: '03', title: 'Certificates', desc: 'ACME via HTTP-01 or DNS-01, wildcards included, or upload your own. Renewal is handled by nginxpilot.' },
    { idx: '04', title: 'Databases', desc: 'Register a Postgres or MySQL server once; create databases and users, grant with presets or per-operation control.' },
    { idx: '05', title: 'App config', desc: 'Env vars and feature flags per instance, pulled by your own apps over the agent API with ETag caching.' },
    { idx: '06', title: 'Docker snippets', desc: 'Save docker run recipes as validated, structured specs with a live command preview.' },
    { idx: '07', title: 'Scheduled tasks', desc: 'Shell or Node scripts on cron or on demand, with stdout, stderr, exit code and duration captured per run.' },
    { idx: '08', title: 'Realms', desc: 'Each nginxpilot daemon you connect — a VPS, a homelab box, a client server — with its own encrypted admin token.' },
];

const PRINCIPLES = [
    { key: '[01]', title: 'Never in the request path', desc: 'Quaykeeper can be down; your sites keep serving. It only orchestrates.' },
    { key: '[02]', title: 'Secrets go one way', desc: 'Tokens, keys and passwords are accepted, encrypted or hashed, and never read back out.' },
    { key: '[03]', title: 'Fail closed', desc: 'Domain verification, webhook signatures, fragment validation — every gate defaults to no.' },
    { key: '[04]', title: 'Boring persistence', desc: 'One SQLite file with WAL and ordered migrations. Back it up with cp.' },
    { key: '[05]', title: 'Owner-gated power', desc: 'Anything touching the host — certs, tasks, realms — needs the highest role and is audited.' },
];

const CONNECT = [
    { n: '1', text: 'Make sure nginxpilot is already running and reachable — see the nginxpilot guide if it isn’t yet.' },
    { n: '2', text: 'In Quaykeeper, open Settings → Realms → Add realm.' },
    { n: '3', text: 'Give it a name and the internal URL of the daemon (e.g. http://nginxpilot:8090).' },
    { n: '4', text: 'Paste the ADMIN_TOKEN nginxpilot printed on first run. It is encrypted immediately and never displayed again.' },
    { n: '5', text: 'Quaykeeper handshakes, reads nginx’s version and current hosts, and the realm goes live.' },
];

export default function QuaykeeperGuidePage() {
    return (
        <div data-root="qk" style={{ ...ROOT_VARS, minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', position: 'relative' }}>
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
                    <div style={{ width: '24px', height: '24px', transform: 'rotate(45deg)', border: '2px solid var(--accent)', borderRadius: '5px' }} />
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '18px', letterSpacing: '-.01em' }}>Quaykeeper</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: 'var(--faint)', borderLeft: '1px solid var(--line)', paddingLeft: '11px', marginLeft: '3px' }}>
                        docs / quaykeeper
                    </span>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <Link href="/nginxpilot-guide/" className="qk-navlink" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                        nginxpilot guide →
                    </Link>
                    <Link href="/" className="qk-navlink" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                        ← back to overview
                    </Link>
                </div>
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
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'qk-pulse 2.4s ease-in-out infinite' }} /> Guide · the
                    console you sign into
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '44px', lineHeight: 1.05, letterSpacing: '-.025em', margin: '0 0 18px', maxWidth: '820px' }}>
                    Quaykeeper — the control plane for infrastructure you already run.
                </h1>
                <p style={{ fontSize: '17px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '680px', margin: '0 0 16px' }}>
                    nginxpilot is the hands; <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>Quaykeeper is the console.</strong> Sign
                    in with GitHub, connect one or more nginxpilot realms, and drive sites, routing, certificates, databases and config
                    from forms instead of terminals.
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--faint)', maxWidth: '680px', margin: 0 }}>
                    Start this <em style={{ fontStyle: 'normal', color: 'var(--muted)' }}>after</em> nginxpilot is up — see the{' '}
                    <Link href="/nginxpilot-guide/" className="qk-navlink" style={{ color: 'var(--tx)' }}>
                        nginxpilot guide
                    </Link>{' '}
                    if you haven&apos;t started it yet.
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
                            Quaykeeper only orchestrates nginxpilot. Either can restart without the other losing state.
                        </div>
                    </div>
                </aside>

                {/* CONTENT */}
                <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '56px' }}>
                    {/* 01 WHAT IT IS */}
                    <section id="what" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>01 · What it is</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            One dashboard instead of five terminals.
                        </h2>
                        <p style={{ fontSize: '15.5px', lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 16px', maxWidth: '720px' }}>
                            Quaykeeper is a small self-hosted app that replaces the SSH sessions, hand-edited configs and cron jobs you&apos;d
                            otherwise juggle to run your own infrastructure. It doesn&apos;t serve traffic and it doesn&apos;t run a database
                            server itself — it holds the{' '}
                            <em style={{ color: 'var(--tx)', fontStyle: 'normal' }}>intent</em>, and delegates the actual work to nginxpilot
                            (for anything nginx) and to the database servers you register (for anything SQL).
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '22px' }}>
                            {TRAITS.map((tr) => (
                                <div key={tr.title} style={{ border: '1px solid var(--line)', borderRadius: '11px', background: 'var(--card)', padding: '16px 17px' }}>
                                    <div style={{ fontSize: '16px', color: 'var(--accent)', marginBottom: '9px' }}>{tr.glyph}</div>
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
                            You decide; the daemons do.
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
                                    you
                                </div>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginTop: '8px' }}>GitHub login</div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--accent)', textAlign: 'center', lineHeight: 1.4 }}>
                                sign in →
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', fontWeight: 600, color: '#08110f', background: 'var(--accent)', borderRadius: '10px', padding: '16px 10px' }}>
                                    Quaykeeper
                                </div>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginTop: '8px' }}>control plane</div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--accent2)', textAlign: 'center', lineHeight: 1.4 }}>
                                admin
                                <br />
                                REST →
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', fontWeight: 600, color: 'var(--tx)', border: '1px solid var(--line2)', borderRadius: '10px', padding: '16px 10px' }}>
                                    nginxpilot + your DBs
                                </div>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10.5px', color: 'var(--faint)', marginTop: '8px' }}>do the actual work</div>
                            </div>
                        </div>
                        <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--muted)', margin: '16px 0 0', maxWidth: '720px' }}>
                            Every server you connect — an nginxpilot daemon or a Postgres/MySQL instance — is registered once with
                            credentials that go in and never come back out. From then on you work through Quaykeeper&apos;s forms, and it
                            translates each action into the right call to the right daemon.
                        </p>
                    </section>

                    {/* 03 INSTALL */}
                    <section id="install" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>03 · Install &amp; run</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Bring it up beside nginxpilot.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 18px', maxWidth: '720px' }}>
                            Run it on the same Docker network as nginxpilot so the two can reach each other, with a GitHub OAuth app
                            configured for its callback URL.
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
                            <div style={{ color: 'var(--faint)' }}># nginxpilot should already be running on this network — see the nginxpilot guide</div>
                            <div style={{ height: '12px' }} />
                            <div style={{ color: 'var(--faint)' }}># pull the image</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>docker</span> pull ghcr.io/kalevski/toolcase/quaykeeper:latest
                            </div>
                            <div style={{ height: '12px' }} />
                            <div style={{ color: 'var(--faint)' }}># run it on the same network as nginxpilot</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>docker</span> run -d --name quaykeeper \
                            </div>
                            <div style={{ paddingLeft: '20px' }}>--network nginxpilot-net \</div>
                            <div style={{ paddingLeft: '20px' }}>-p 4100:3000 -p 4101:4101 \</div>
                            <div style={{ paddingLeft: '20px' }}>
                                -e QUAYKEEPER_GITHUB_CLIENT_ID=&quot;&lt;github-oauth-client-id&gt;&quot; \
                            </div>
                            <div style={{ paddingLeft: '20px' }}>
                                -e QUAYKEEPER_GITHUB_CLIENT_SECRET=&quot;&lt;github-oauth-client-secret&gt;&quot; \
                            </div>
                            <div style={{ paddingLeft: '20px' }}>
                                -e QUAYKEEPER_OAUTH_REDIRECT_URI=&quot;http://localhost:4100/api/auth/github/callback&quot; \
                            </div>
                            <div style={{ paddingLeft: '20px' }}>-e QUAYKEEPER_AUTH_SECRET=&quot;$(openssl rand -hex 32)&quot; \</div>
                            <div style={{ paddingLeft: '20px' }}>-v &quot;$HOME/quaykeeper-workspace:/workspace&quot; \</div>
                            <div style={{ paddingLeft: '20px' }}>ghcr.io/kalevski/toolcase/quaykeeper:latest</div>
                            <div style={{ height: '12px' }} />
                            <div style={{ color: 'var(--accent2)' }}>✓ listening on :4100 — open it and sign in with GitHub</div>
                        </div>
                        <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--faint)', margin: '12px 0 0', maxWidth: '720px' }}>
                            Those four are the only vars that fail fast at boot if missing —{' '}
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>QUAYKEEPER_GITHUB_CLIENT_ID</span>,{' '}
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>_CLIENT_SECRET</span>,{' '}
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>_OAUTH_REDIRECT_URI</span> and{' '}
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>_AUTH_SECRET</span>. The redirect URI must exactly
                            match the callback URL on the GitHub OAuth app. Everything else — realms, sites, certs — is configured from
                            the UI after first login.
                        </p>
                    </section>

                    {/* 04 SIGN IN & ROLES */}
                    <section id="roles" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>04 · Sign in &amp; roles</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            The first login becomes the owner.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 18px', maxWidth: '720px' }}>
                            There&apos;s no separate signup step — whoever authorizes the GitHub OAuth app first is the owner, with full
                            access to everything. The owner can then invite teammates, who get scoped access without host-level power.
                        </p>
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
                            }}
                        >
                            <div style={{ color: 'var(--faint)' }}># first visit to Quaykeeper</div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>open</span> http://localhost:4100
                            </div>
                            <div>
                                <span style={{ color: 'var(--accent)' }}>click</span> &quot;Sign in with GitHub&quot;
                            </div>
                            <div style={{ height: '10px' }} />
                            <div style={{ color: 'var(--accent2)' }}>✓ no existing users found — you are now the owner</div>
                        </div>
                        <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', margin: '16px 0 0', maxWidth: '720px' }}>
                            Owner-only actions — adding realms, issuing certs, running scheduled tasks, anything that reaches the host —
                            stay owner-gated and are written to the audit log even for the owner.
                        </p>
                    </section>

                    {/* 05 WHAT YOU MANAGE */}
                    <section id="surfaces" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>05 · What you manage</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Eight surfaces, all forms.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 20px', maxWidth: '720px' }}>
                            Once at least one nginxpilot realm is connected, these are the things Quaykeeper lets you drive without ever
                            reaching for SSH.
                        </p>
                        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                            {SURFACES.map((s) => (
                                <div
                                    key={s.idx}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '48px 1fr 2fr',
                                        gap: '10px',
                                        alignItems: 'center',
                                        padding: '13px 18px',
                                        borderBottom: '1px solid var(--line)',
                                    }}
                                >
                                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: 'var(--faint)' }}>{s.idx}</div>
                                    <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{s.title}</div>
                                    <div style={{ color: 'var(--muted)', fontSize: '12.5px', lineHeight: 1.5 }}>{s.desc}</div>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--faint)', margin: '14px 0 0', maxWidth: '720px' }}>
                            See these in action on the{' '}
                            <Link href="/screenshots/" className="qk-navlink" style={{ color: 'var(--muted)' }}>
                                screenshots page
                            </Link>
                            .
                        </p>
                    </section>

                    {/* 06 SECURITY PRINCIPLES */}
                    <section id="principles" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>06 · Security model</div>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '26px', letterSpacing: '-.02em', margin: '0 0 16px' }}>
                            Five rules the whole app follows.
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: '14px', background: 'var(--bg2)', overflow: 'hidden' }}>
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
                    </section>

                    {/* 07 CONNECT */}
                    <section id="connect" style={{ scrollMarginTop: '24px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>07 · Connect nginxpilot</div>
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
                                                background: 'var(--accent)',
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
                            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '20px', margin: '0 0 6px' }}>That&apos;s the whole console.</h3>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', maxWidth: '520px' }}>
                                From here it&apos;s deploys, routing, certs and databases — all from the UI you just signed into.
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
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px', color: 'var(--faint)' }}>Quaykeeper · the console you sign into</span>
                <Link href="/" className="qk-navlink" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    Quaykeeper overview →
                </Link>
            </footer>
        </div>
    );
}
