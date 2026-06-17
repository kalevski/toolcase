import React, { useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const stageStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 240,
    background: 'var(--tc-surface-muted)',
    border: '1px solid var(--tc-border)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}

const sceneLabelStyle: React.CSSProperties = {
    fontFamily: 'var(--tc-font-mono, "JetBrains Mono", monospace)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--tc-text-faint)',
}

const LetterboxBarsDemo: React.FC = () => {
    const [show, setShow] = useState(false)
    const [showTall, setShowTall] = useState(false)
    const [showCustom, setShowCustom] = useState(false)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Letterbox Bars"
                            description="Animated cinematic letterbox bars for cutscenes and reveal transitions. Two flat ink bars slide in from the top and bottom edges when show is set, and slide back out when it is removed. Ported from gc-letterbox-bars but re-voiced for the design system — no game chrome, just slate ink bars and a configurable CSS transition."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default (80px bars, slate ink)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Toggle <code>[show]</code> to slide the bars in and out. The default bar height
                                    is 80 px; the default color is <code>var(--tc-ink)</code>.
                                </p>
                                <div style={stageStyle}>
                                    <span style={sceneLabelStyle}>Scene viewport</span>
                                    {/* @ts-ignore */}
                                    <tc-letterbox-bars {...(show ? { show: '' } : {})} />
                                </div>
                                <div className="mt-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShow(v => !v)}
                                    >
                                        {show ? 'Hide bars' : 'Show bars'}
                                    </button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Tall bars (bar-height=&quot;140px&quot;)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    A taller cinematic cut — useful for a more extreme widescreen ratio.
                                    Pass any CSS length to <code>bar-height</code>.
                                </p>
                                <div style={stageStyle}>
                                    <span style={sceneLabelStyle}>Scene viewport</span>
                                    {/* @ts-ignore */}
                                    <tc-letterbox-bars bar-height="140px" {...(showTall ? { show: '' } : {})} />
                                </div>
                                <div className="mt-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowTall(v => !v)}
                                    >
                                        {showTall ? 'Hide bars' : 'Show bars'}
                                    </button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom color + faster transition">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    <code>bar-color</code> accepts any CSS color value;{' '}
                                    <code>duration</code> controls the slide speed (default <code>0.4s</code>).
                                </p>
                                <div style={stageStyle}>
                                    <span style={sceneLabelStyle}>Scene viewport</span>
                                    {/* @ts-ignore */}
                                    <tc-letterbox-bars
                                        bar-color="var(--tc-app-accent)"
                                        duration="0.2s"
                                        {...(showCustom ? { show: '' } : {})}
                                    />
                                </div>
                                <div className="mt-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowCustom(v => !v)}
                                    >
                                        {showCustom ? 'Hide bars' : 'Show bars'}
                                    </button>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LetterboxBarsDemo
