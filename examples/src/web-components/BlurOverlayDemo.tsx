import React, { useState } from 'react'

type Variant = {
    key: string
    title: string
    description: string
    blurAmount?: string
    background?: string
}

const VARIANTS: Variant[] = [
    {
        key: 'default',
        title: 'Default scrim',
        description:
            'Defaults — 8px blur over a slate-ink wash. Click the backdrop (or Resume) to dismiss.',
    },
    {
        key: 'strong',
        title: 'blur-amount="14px"',
        description: 'A heavier blur for a fully-obscured pause screen.',
        blurAmount: '14px',
    },
    {
        key: 'tinted',
        title: 'background="rgba(2, 6, 23, 0.7)"',
        description: 'A darker custom scrim — both knobs are free-form CSS values.',
        blurAmount: '6px',
        background: 'rgba(2, 6, 23, 0.7)',
    },
]

const panelStyle: React.CSSProperties = {
    background: 'var(--tc-surface)',
    border: '1px solid var(--tc-border)',
    boxShadow: 'var(--tc-shadow-lg)',
    padding: '1.5rem',
    maxWidth: '360px',
    width: '100%',
    textAlign: 'center',
}

const BlurOverlayDemo: React.FC = () => {
    const [openKey, setOpenKey] = useState<string | null>(null)
    const active = VARIANTS.find((v) => v.key === openKey) ?? null

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Blur Overlay"
                            description="Full-surface backdrop-blur scrim for pause screens and dialog backdrops. Built for the toolcase design system — a slate-ink wash on the fixed overlay tier, sharp edges, no fantasy chrome. Blur amount and background are free-form CSS values."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            {VARIANTS.map((v) => (
                                <tc-section-card key={v.key} title={v.title}>
                                    <p className="mb-3" style={{ opacity: 0.85 }}>
                                        {v.description}
                                    </p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setOpenKey(v.key)}
                                    >
                                        Open {v.title.toLowerCase()}
                                    </button>
                                </tc-section-card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {active && (
                // The consumer mounts/unmounts the passive scrim. Clicking the
                // backdrop (the host itself) closes; the panel stops propagation.
                /* @ts-ignore */
                <tc-blur-overlay
                    blur-amount={active.blurAmount}
                    background={active.background}
                    onClick={() => setOpenKey(null)}
                >
                    <div style={panelStyle} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
                            Paused
                        </h3>
                        <p style={{ margin: '0 0 1rem', opacity: 0.8 }}>
                            The page behind this panel is blurred by the overlay.
                        </p>
                        <button className="btn btn-primary" onClick={() => setOpenKey(null)}>
                            Resume
                        </button>
                    </div>
                    {/* @ts-ignore */}
                </tc-blur-overlay>
            )}
        </div>
    )
}

export default BlurOverlayDemo
