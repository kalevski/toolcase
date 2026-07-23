import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const stageStyle: React.CSSProperties = {
    width: '100%',
    height: 240,
    background: 'linear-gradient(135deg, var(--tc-surface-muted) 0%, var(--tc-surface) 100%)',
    border: '1px solid var(--tc-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
}

const sceneLabel: React.CSSProperties = {
    fontFamily: 'var(--tc-font-mono, "JetBrains Mono", monospace)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--tc-text-faint)',
    userSelect: 'none',
}

const VignetteOverlayDemo: React.FC = () => {
    const [intensity, setIntensity] = useState(0.6)
    const [active, setActive] = useState(true)

    const customRef = useTc<HTMLElement>({ intensity })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Vignette Overlay"
                            description="Edge vignette overlay for damage feedback and cinematic framing. A radial-gradient ::after pseudo-element is painted on top of slotted content with pointer-events disabled. Intensity (0–1) and vignette-color (any CSS color) are reflected attributes that write through as CSS custom property overrides. Ported from gc-vignette-overlay and re-voiced for the design system."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (intensity=0.6, black edges)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    The default vignette uses a black radial gradient at 60%
                                    opacity. Content inside the element is the default slot.
                                </p>
                                <div style={stageStyle}>
                                    {/* @ts-ignore */}
                                    <tc-vignette-overlay style={{ width: '100%', height: '100%' }}>
                                        <span style={sceneLabel}>Slotted content</span>
                                        {/* @ts-ignore */}
                                    </tc-vignette-overlay>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Toggle intensity">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Toggle the vignette between visible (<code>0.65</code>) and
                                    hidden (<code>0</code>) by setting the <code>intensity</code>{' '}
                                    attribute.
                                </p>
                                <div style={stageStyle}>
                                    {/* @ts-ignore */}
                                    <tc-vignette-overlay
                                        intensity={active ? 0.65 : 0}
                                        style={{ width: '100%', height: '100%' }}
                                    >
                                        <span style={sceneLabel}>Slotted content</span>
                                        {/* @ts-ignore */}
                                    </tc-vignette-overlay>
                                </div>
                                <div className="mt-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setActive((v) => !v)}
                                    >
                                        {active ? 'Hide vignette' : 'Show vignette'}
                                    </button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom color (danger red)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Pass any CSS color to <code>vignette-color</code> to change the
                                    edge tone — useful for low-health or status feedback.
                                </p>
                                <div style={stageStyle}>
                                    {/* @ts-ignore */}
                                    <tc-vignette-overlay
                                        intensity="0.7"
                                        vignette-color="var(--tc-danger)"
                                        style={{ width: '100%', height: '100%' }}
                                    >
                                        <span style={sceneLabel}>Slotted content</span>
                                        {/* @ts-ignore */}
                                    </tc-vignette-overlay>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="JS-property driven intensity slider">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Drive <code>intensity</code> via the JS property for animation
                                    or reactive updates. Uses a <code>ref</code> to set the property
                                    directly on the element.
                                </p>
                                <div style={stageStyle}>
                                    {/* @ts-ignore */}
                                    <tc-vignette-overlay
                                        ref={customRef}
                                        style={{ width: '100%', height: '100%' }}
                                    >
                                        <span style={sceneLabel}>Slotted content</span>
                                        {/* @ts-ignore */}
                                    </tc-vignette-overlay>
                                </div>
                                <div className="mt-3 d-flex align-items-center gap-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={intensity}
                                        onChange={(e) => setIntensity(parseFloat(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span
                                        style={{
                                            fontFamily: 'var(--tc-font-mono)',
                                            fontSize: '13px',
                                            minWidth: '3ch',
                                        }}
                                    >
                                        {intensity.toFixed(2)}
                                    </span>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VignetteOverlayDemo
