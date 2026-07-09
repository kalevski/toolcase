import Link from 'next/link';
import { Slideshow } from './Slideshow';

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

const FEATURES = [
    {
        idx: '01',
        glyph: '◉',
        title: 'CPU-only transcription',
        desc: 'whisper.cpp runs entirely on your own CPU, inside the container. No GPU to buy, no per-minute cloud bill.',
        tags: ['whisper.cpp', 'cpu-only', 'no gpu'],
    },
    {
        idx: '02',
        glyph: '⇧',
        title: 'Any audio or video in',
        desc: 'mp3, wav, m4a, aac, flac, ogg, opus, webm, mp4, mov, mkv — video is accepted, the audio track is extracted for you.',
        tags: ['multi-format', 'auto-extract'],
    },
    {
        idx: '03',
        glyph: '⇄',
        title: '~99 languages, translate too',
        desc: 'Auto-detect or pick a language explicitly, then optionally translate straight to English in the same pass.',
        tags: ['auto-detect', 'translate'],
    },
    {
        idx: '04',
        glyph: '▶',
        title: 'Synced transcript player',
        desc: 'Click any line to seek the audio there. The line playing right now highlights and scrolls into view on its own.',
        tags: ['synced player', 'segments'],
    },
    {
        idx: '05',
        glyph: '▤',
        title: 'Subtitle-ready exports',
        desc: 'Download as .txt, .srt, .vtt or the raw .json — captions for video, plain text for everything else.',
        tags: ['.srt', '.vtt', '.json'],
    },
    {
        idx: '06',
        glyph: '⌕',
        title: 'Search everything you have',
        desc: 'Full-text search across every transcript and note, powered by SQLite FTS5, with the matching snippet shown inline.',
        tags: ['fts5', 'snippets'],
    },
    {
        idx: '07',
        glyph: '≡',
        title: 'Tagged markdown notes',
        desc: 'Standups, meetings, anything — date-stamped, tagged, and searched the same way as your transcripts.',
        tags: ['markdown', 'tags'],
    },
    {
        idx: '08',
        glyph: '◈',
        title: 'Roles & live rebranding',
        desc: 'Guest/standard/admin on one instance, plus a live theme and brand editor — changes apply to everyone instantly.',
        tags: ['rbac', 'theming'],
    },
];

const PRINCIPLES = [
    { key: '[01]', title: 'Audio never leaves your infrastructure', desc: 'whisper.cpp runs inside your own container. Nothing is ever sent to a third-party transcription API.' },
    { key: '[02]', title: "Someone else's data 404s, never 403s", desc: "A resource you don't own doesn't appear to exist at all — not even as a permission error. Admins are the only exception." },
    { key: '[03]', title: 'Crash-safe by construction', desc: 'A job stuck mid-transcription when the process dies goes back to pending on restart. Orphaned files are swept daily.' },
    { key: '[04]', title: 'Boring SQLite persistence', desc: 'One file, WAL mode, full-text search built in. No external database, no message broker, no moving parts to babysit.' },
    { key: '[05]', title: 'Budget-conscious by design', desc: 'No large model tier, worker concurrency capped at 1 — tuned to run reliably on a machine you already own, not a GPU box.' },
];

const TOUR = [
    {
        src: '/screenshots/new-transcription.png',
        label: 'new transcription — upload',
        title: 'Drop in a file',
        desc: 'Drag audio or video in. Language, model and translate are all optional — sane defaults if you skip them.',
    },
    {
        src: '/screenshots/library.png',
        label: 'library — search',
        title: 'It lands in your library',
        desc: 'Full-text search over every transcript, status chips that update live while a job runs.',
    },
    {
        src: '/screenshots/dashboard.png',
        label: 'dashboard — overview',
        title: 'Rolled up on the dashboard',
        desc: 'Minutes transcribed, disk used, notes written — the whole instance at a glance.',
    },
];

const PERSONAS = [
    { mark: '☎', who: 'Remote teams', desc: 'Standup and meeting notes, plus call transcripts, searchable in the same place.' },
    { mark: '✎', who: 'Journalists & researchers', desc: 'Interview transcripts that never leave infrastructure you control.' },
    { mark: '⛨', who: 'Privacy-conscious orgs', desc: "Audio that can't cross a compliance boundary, because it never has to." },
    { mark: '~/', who: 'Self-hosters & homelabbers', desc: 'One more genuinely useful container on hardware you already run.' },
];

export default function LandingPage() {
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
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '19px', letterSpacing: '-.01em' }}>voxscribe</span>
                </div>
                <nav style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}>
                    <a href="#features" className="vs-navlink">
                        Features
                    </a>
                    <a href="#architecture" className="vs-navlink">
                        Architecture
                    </a>
                    <Link href="/screenshots/" className="vs-navlink">
                        Screenshots
                    </Link>
                </nav>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <a
                        href="#start"
                        className="vs-deploy-btn"
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
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'vs-pulse 2.4s ease-in-out infinite' }} />
                        Self-hosted · CPU-only · Yours
                    </div>
                    <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '52px', lineHeight: 1.04, letterSpacing: '-.025em', margin: '0 0 22px' }}>
                        Transcription that
                        <br />
                        stays on your
                        <br />
                        <span style={{ color: 'var(--accent)' }}>hardware</span>.
                    </h1>
                    <p style={{ fontSize: '17.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '520px', margin: '0 0 34px' }}>
                        Audio and video in, searchable transcripts and tagged notes out. whisper.cpp runs on your own CPU — nothing is
                        ever sent to a third party.
                    </p>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a
                            href="#start"
                            className="vs-cta-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '15px', fontWeight: 600, padding: '13px 22px', borderRadius: '10px' }}
                        >
                            Get started <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>→</span>
                        </a>
                        <a
                            href="#architecture"
                            className="vs-cta-secondary"
                            style={{ fontSize: '15px', fontWeight: 500, border: '1px solid var(--line2)', padding: '13px 22px', borderRadius: '10px' }}
                        >
                            See how it works
                        </a>
                    </div>
                    <div style={{ display: 'flex', gap: '26px', marginTop: '40px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--faint)' }}>
                        <div>
                            <span style={{ color: 'var(--tx)', fontSize: '19px', fontWeight: 600, display: 'block', fontFamily: "'Space Grotesk',sans-serif" }}>1</span>
                            container
                        </div>
                        <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '26px' }}>
                            <span style={{ color: 'var(--tx)', fontSize: '19px', fontWeight: 600, display: 'block', fontFamily: "'Space Grotesk',sans-serif" }}>CPU-only</span>
                            no GPU needed
                        </div>
                        <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '26px' }}>
                            <span style={{ color: 'var(--tx)', fontSize: '19px', fontWeight: 600, display: 'block', fontFamily: "'Space Grotesk',sans-serif" }}>0</span>
                            cloud API calls
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
                        <span style={{ marginLeft: '8px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '11.5px', color: 'var(--faint)' }}>transcription.pipeline</span>
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
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>upload →</div>
                            <div
                                style={{
                                    flex: 1.3,
                                    textAlign: 'center',
                                    fontFamily: "'IBM Plex Mono',monospace",
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#06140f',
                                    background: 'var(--accent)',
                                    borderRadius: '9px',
                                    padding: '12px 8px',
                                }}
                            >
                                voxscribe
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
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--faint)' }}>transcode →</div>
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
                                    ffmpeg → 16kHz mono
                                </div>
                            </div>
                            <div style={{ height: '1px', background: 'var(--line)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--faint)' }}>transcribe →</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'vs-pulse 2.4s ease-in-out infinite' }} />
                                    whisper.cpp · your CPU
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
                                SQLite · FTS5
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
                                transcript + notes
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
                        <span style={{ color: 'var(--accent2)' }}>◆</span> audio never leaves the container — transcodes, transcribes, indexes, done
                    </div>
                </div>
            </section>

            {/* PROBLEM STRIP */}
            <section style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '56px auto 0', padding: '0 40px' }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: '16px', background: 'var(--bg2)', padding: '36px 38px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '24px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// the problem</span>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '24px', letterSpacing: '-.02em', margin: 0 }}>
                            One small setup, six open tabs.
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '18px 30px' }}>
                        {[
                            { n: '01', text: <>Per-minute cloud transcription bills that scale with every meeting you record.</> },
                            { n: '02', text: <>Audio leaving your infrastructure to a third-party AI vendor you don&apos;t control.</> },
                            { n: '03', text: <>A GPU box you don&apos;t have, don&apos;t want to manage, and can&apos;t justify buying.</> },
                            { n: '04', text: <>A separate meeting-notes app with its own search, its own login, its own bill.</> },
                            { n: '05', text: <>Converting transcripts to <span style={{ color: 'var(--tx)' }}>.srt</span>/<span style={{ color: 'var(--tx)' }}>.vtt</span> by hand for captions, file by file.</> },
                            { n: '06', text: <>Losing track of which file you already transcribed, and paying to do it twice.</> },
                        ].map((row) => (
                            <div key={row.n} style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: 'var(--faint)', fontSize: '12px' }}>{row.n}</span>
                                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--muted)' }}>{row.text}</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ margin: '26px 0 0', fontSize: '15px', color: 'var(--tx)' }}>
                        Each is simple alone. Together they turn a small habit into a recurring bill and a privacy question.{' '}
                        <span style={{ color: 'var(--accent)' }}>voxscribe replaces all of it with one container.</span>
                    </p>
                </div>
            </section>

            {/* FEATURES */}
            <section id="features" style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '100px auto 0', padding: '0 40px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '34px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// what you get</span>
                    <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '32px', letterSpacing: '-.025em', margin: 0 }}>
                        Everything a transcription studio needs, none of the cloud bill.
                    </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
                    {FEATURES.map((f) => (
                        <div
                            key={f.idx}
                            className="vs-feature-card"
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

            {/* PRODUCT TOUR */}
            <section style={{ position: 'relative', zIndex: 2, margin: '100px auto 0' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '14px',
                        flexWrap: 'wrap',
                        maxWidth: '1200px',
                        margin: '0 auto',
                        padding: '0 40px',
                        marginBottom: '26px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// the real thing</span>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '30px', letterSpacing: '-.025em', margin: 0 }}>
                            No mockups. This is the app.
                        </h2>
                    </div>
                    <Link href="/screenshots/" className="vs-navlink" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px' }}>
                        More screenshots →
                    </Link>
                </div>
                <Slideshow slides={TOUR} progress="dots" autoPlayMs={6000} />
            </section>

            {/* ARCHITECTURE + PRINCIPLES */}
            <section id="architecture" style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '100px auto 0', padding: '0 40px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '44px', alignItems: 'start' }}>
                    <div>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: 'var(--accent)' }}>// how it&apos;s built</span>
                        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '30px', letterSpacing: '-.025em', margin: '12px 0 18px' }}>
                            One image. Everything it needs is inside.
                        </h2>
                        <p style={{ fontSize: '15.5px', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 16px' }}>
                            The Next.js app, <span style={{ color: 'var(--tx)' }}>node:sqlite</span> with WAL and FTS5, whisper.cpp and
                            ffmpeg all ship in a single container. A single in-process worker claims jobs one at a time, transcodes to
                            16kHz mono, runs whisper-cli, and indexes the result — no external database, no message queue, no GPU
                            driver to install.
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
                        Built for anyone who&apos;d rather not ship audio to a stranger.
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
                    Not a SaaS. Not a subscription. Not a call to someone else&apos;s API.{' '}
                    <span style={{ color: 'var(--muted)' }}>A transcription studio that runs on infrastructure that&apos;s already yours.</span>
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
                            One container. You&apos;re the admin.
                        </h2>
                        <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--muted)', margin: '0 0 18px' }}>
                            Sign in happens over GitHub OAuth — there&apos;s no local password to set up.{' '}
                            <strong style={{ color: 'var(--tx)' }}>The first person to sign in becomes admin</strong>; everyone after
                            lands as a standard user, or as a guest if you&apos;ve configured an allow-list. Role changes apply on the
                            very next request — no re-login needed.
                        </p>
                        <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--muted)', margin: 0 }}>
                            Everything durable — the SQLite file, uploaded media, downloaded models, notes — lives under one bind-mounted{' '}
                            <span style={{ color: 'var(--tx)', fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px' }}>/workspace</span> volume. Back it up with{' '}
                            <span style={{ color: 'var(--tx)', fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px' }}>cp</span>.
                        </p>
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
                        <div style={{ color: 'var(--accent)' }}># pull and run</div>
                        <div>
                            <span style={{ color: 'var(--accent2)' }}>docker</span> pull ghcr.io/kalevski/toolcase/voxscribe:latest
                        </div>
                        <div style={{ height: '14px' }} />
                        <div>
                            <span style={{ color: 'var(--accent2)' }}>docker</span> run -d --restart unless-stopped \
                        </div>
                        <div style={{ paddingLeft: '20px' }}>--name voxscribe \</div>
                        <div style={{ paddingLeft: '20px' }}>-p 4200:4200 \</div>
                        <div style={{ paddingLeft: '20px' }}>-v &quot;$HOME/voxscribe-workspace:/workspace&quot; \</div>
                        <div style={{ paddingLeft: '20px' }}>--memory 5g \</div>
                        <div style={{ paddingLeft: '20px' }}>-e VOXSCRIBE_GITHUB_CLIENT_ID=&quot;&lt;github-oauth-client-id&gt;&quot; \</div>
                        <div style={{ paddingLeft: '20px' }}>-e VOXSCRIBE_GITHUB_CLIENT_SECRET=&quot;&lt;github-oauth-client-secret&gt;&quot; \</div>
                        <div style={{ paddingLeft: '20px' }}>-e VOXSCRIBE_AUTH_SECRET=&quot;$(openssl rand -hex 32)&quot; \</div>
                        <div style={{ paddingLeft: '20px' }}>
                            -e VOXSCRIBE_OAUTH_REDIRECT_URI=&quot;https://your-domain/api/auth/github/callback&quot; \
                        </div>
                        <div style={{ paddingLeft: '20px' }}>ghcr.io/kalevski/toolcase/voxscribe:latest</div>
                        <div style={{ height: '12px' }} />
                        <div style={{ color: 'var(--faint)' }}># open voxscribe, sign in with GitHub — you&apos;re the admin</div>
                        <div style={{ color: 'var(--accent)' }}>✓ signed in — you&apos;re the admin</div>
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
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '16px' }}>voxscribe</span>
                    <span style={{ color: 'var(--faint)', fontSize: '14px', marginLeft: '6px' }}>say it once. search it forever.</span>
                </div>
                <div style={{ display: 'flex', gap: '26px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12.5px' }}>
                    <a href="#features" className="vs-navlink">
                        Features
                    </a>
                    <a href="#architecture" className="vs-navlink">
                        Architecture
                    </a>
                    <Link href="/screenshots/" className="vs-navlink">
                        Screenshots
                    </Link>
                    <a href="#start" className="vs-navlink">
                        GitHub
                    </a>
                </div>
            </footer>
        </div>
    );
}
