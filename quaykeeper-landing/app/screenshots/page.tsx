import Link from 'next/link';
import { Slideshow } from '../Slideshow';

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

const GALLERY = [
    { src: '/screenshots/databases.png', label: 'databases', title: 'Connected DB servers', desc: 'Register a Postgres or MySQL server once; Quaykeeper reads its catalogs live.' },
    { src: '/screenshots/database-access.png', label: 'database — access', title: 'Grants without psql', desc: 'Per-user access levels, applied as a full reset + grant so drift gets repaired, not layered.' },
    { src: '/screenshots/proxies.png', label: 'routing — proxies', title: 'Reverse proxies', desc: 'Every vhost and the upstream pool it targets, with a config test before anything reloads.' },
    { src: '/screenshots/docker-snippet.png', label: 'docker snippets — grafana', title: 'Docker run, as a spec', desc: 'A saved snippet renders to a real docker run command, ready to copy.' },
];

const FLOW = [
    { src: '/screenshots/create-site-repo.png', label: 'step 1 of 3', title: 'Pick a repo & branch', desc: 'Quaykeeper deploys pre-built static content — point it at whichever branch already holds the site.' },
    { src: '/screenshots/create-site-hostname.png', label: 'step 2 of 3', title: 'Choose a hostname', desc: 'A free Quaykeeper subdomain, or bring your own domain via DNS A-records.' },
    { src: '/screenshots/create-site-review.png', label: 'step 3 of 3', title: 'Review & create', desc: 'Confirm the repo, branch and hostname — Quaykeeper writes the deploy config and starts the first sync.' },
];

export default function ScreenshotsPage() {
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
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '11px', textDecoration: 'none', color: 'var(--tx)' }}>
                    <div style={{ width: '26px', height: '26px', transform: 'rotate(45deg)', border: '2px solid var(--accent)', borderRadius: '5px', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '5px', background: 'var(--accent)', borderRadius: '2px', opacity: 0.35 }} />
                    </div>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '19px', letterSpacing: '-.01em' }}>Quaykeeper</span>
                </Link>
                <nav style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}>
                    <Link href="/#features" className="qk-navlink">
                        Features
                    </Link>
                    <Link href="/#architecture" className="qk-navlink">
                        Architecture
                    </Link>
                    <Link href="/nginxpilot-guide/" className="qk-navlink">
                        nginxpilot guide
                    </Link>
                    <Link href="/quaykeeper-guide/" className="qk-navlink">
                        Quaykeeper guide
                    </Link>
                    <Link href="/#start" className="qk-navlink">
                        Get started
                    </Link>
                </nav>
                <Link href="/#start" className="qk-deploy-btn" style={{ fontSize: '13.5px', fontWeight: 600, padding: '9px 16px', borderRadius: '8px' }}>
                    Deploy
                </Link>
            </header>

            {/* HEADER */}
            <section style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '30px auto 0', padding: '0 40px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// screenshots</span>
                <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '40px', letterSpacing: '-.025em', margin: '12px 0 14px' }}>
                    Every corner of the console.
                </h1>
                <p style={{ fontSize: '15.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '640px', margin: 0 }}>
                    The highlights are on the{' '}
                    <Link href="/" className="qk-navlink" style={{ color: 'var(--tx)' }}>
                        homepage
                    </Link>
                    . This is the rest — databases, routing, docker snippets, and the full site-creation flow.
                </p>
            </section>

            {/* CREATE-SITE FLOW */}
            <section style={{ position: 'relative', zIndex: 2, margin: '64px auto 0' }}>
                <h2
                    style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontWeight: 600,
                        fontSize: '22px',
                        letterSpacing: '-.02em',
                        margin: '0 0 22px',
                        maxWidth: '1200px',
                        padding: '0 40px',
                        marginInline: 'auto',
                    }}
                >
                    Creating a site, start to finish
                </h2>
                <Slideshow slides={FLOW} progress="steps" autoPlayMs={5000} />
            </section>

            {/* GALLERY */}
            <section style={{ position: 'relative', zIndex: 2, margin: '72px auto 0' }}>
                <h2
                    style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontWeight: 600,
                        fontSize: '22px',
                        letterSpacing: '-.02em',
                        margin: '0 0 22px',
                        maxWidth: '1200px',
                        padding: '0 40px',
                        marginInline: 'auto',
                    }}
                >
                    Databases, routing & config
                </h2>
                <Slideshow slides={GALLERY} progress="dots" autoPlayMs={7000} />
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
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '11px', textDecoration: 'none', color: 'var(--tx)' }}>
                    <div style={{ width: '20px', height: '20px', transform: 'rotate(45deg)', border: '2px solid var(--accent)', borderRadius: '4px' }} />
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '16px' }}>Quaykeeper</span>
                    <span style={{ color: 'var(--faint)', fontSize: '14px', marginLeft: '6px' }}>keep the quay, ship the fleet.</span>
                </Link>
                <div style={{ display: 'flex', gap: '26px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    <Link href="/#features" className="qk-navlink">
                        Features
                    </Link>
                    <Link href="/nginxpilot-guide/" className="qk-navlink">
                        nginxpilot guide
                    </Link>
                    <Link href="/quaykeeper-guide/" className="qk-navlink">
                        Quaykeeper guide
                    </Link>
                    <Link href="/#start" className="qk-navlink">
                        Docs
                    </Link>
                </div>
            </footer>
        </div>
    );
}
