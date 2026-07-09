import Link from 'next/link';
import { Slideshow } from '../Slideshow';

const ROOT_VARS = {
    '--accent': '#2f9e8a',
    '--accent2': '#2f9e8a',
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
    { src: '/screenshots/dashboard.png', label: 'dashboard', title: 'Dashboard', desc: 'Minutes transcribed, disk used, jobs in queue, notes written — the whole instance at a glance.' },
    { src: '/screenshots/new-transcription.png', label: 'new transcription', title: 'New transcription', desc: 'Drag audio or video in. mp3, wav, m4a, aac, flac, ogg, opus, webm, mp4, mov, mkv — video gets its audio track extracted automatically.' },
    { src: '/screenshots/library.png', label: 'library', title: 'Library', desc: 'Full-text search over titles and spoken content, filterable by status and language, with live status chips.' },
    { src: '/screenshots/admin-models.png', label: 'admin — models', title: 'Model manager', desc: "tiny/base/small/medium, downloaded on demand. large isn't offered — it doesn't fit the RAM budget, by design." },
];

export default function ScreenshotsPage() {
    return (
        <div data-root="vs" style={{ ...ROOT_VARS, minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', position: 'relative', overflowX: 'hidden' }}>
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
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '19px', letterSpacing: '-.01em' }}>voxscribe</span>
                </Link>
                <nav style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}>
                    <Link href="/#features" className="vs-navlink">
                        Features
                    </Link>
                    <Link href="/#architecture" className="vs-navlink">
                        Architecture
                    </Link>
                    <Link href="/#start" className="vs-navlink">
                        Get started
                    </Link>
                </nav>
                <Link href="/#start" className="vs-deploy-btn" style={{ fontSize: '13.5px', fontWeight: 600, padding: '9px 16px', borderRadius: '8px' }}>
                    Deploy
                </Link>
            </header>

            {/* HEADER */}
            <section style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '30px auto 0', padding: '0 40px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// screenshots</span>
                <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '40px', letterSpacing: '-.025em', margin: '12px 0 14px' }}>
                    Every corner of the studio.
                </h1>
                <p style={{ fontSize: '15.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '640px', margin: 0 }}>
                    The highlights are on the{' '}
                    <Link href="/" className="vs-navlink" style={{ color: 'var(--tx)' }}>
                        homepage
                    </Link>
                    . This is the rest — the dashboard, uploading a file, the searchable library, and the model manager.
                </p>
            </section>

            {/* GALLERY */}
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
                    Dashboard, upload, library & models
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
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '16px' }}>voxscribe</span>
                    <span style={{ color: 'var(--faint)', fontSize: '14px', marginLeft: '6px' }}>say it once. search it forever.</span>
                </Link>
                <div style={{ display: 'flex', gap: '26px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    <Link href="/#features" className="vs-navlink">
                        Features
                    </Link>
                    <Link href="/#start" className="vs-navlink">
                        Get started
                    </Link>
                </div>
            </footer>
        </div>
    );
}
