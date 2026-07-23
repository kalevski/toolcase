import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const HitMarkerDemo: React.FC = () => {
    // The markers pop-and-fade once then auto-clear their `show` attribute;
    // bumping this key remounts them so the animation can be watched again.
    const [replayKey, setReplayKey] = useState(0)

    const [doneCount, setDoneCount] = useState(0)
    const eventRef = useTcEvents<HTMLElement>({
        'tc-done': () => setDoneCount((c) => c + 1),
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Hit Marker"
                            description="A transient hit-confirmation reticle — four inward-pointing corner ticks that pop in and fade out over a configurable duration, then fire tc-done and auto-clear themselves. Re-skinned to the toolcase voice — sharp slate/status strokes, no fantasy chrome."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="mt-4">
                            <button
                                type="button"
                                className="btn btn-dark"
                                onClick={() => setReplayKey((k) => k + 1)}
                            >
                                Replay markers
                            </button>
                        </div>

                        <div className="d-flex flex-column gap-4 mt-4" key={replayKey}>
                            <tc-section-card title="Variants">
                                <div
                                    className="d-flex align-items-center gap-5"
                                    style={{ minHeight: 80 }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-hit-marker show size="36" duration="3000" />
                                    {/* @ts-ignore */}
                                    <tc-hit-marker show crit size="36" duration="3000" />
                                    {/* @ts-ignore */}
                                    <tc-hit-marker show kill size="36" duration="3000" />
                                </div>
                                <div className="form-text mt-2">
                                    Normal (slate ink) · <code>crit</code> (warning amber) ·{' '}
                                    <code>kill</code> (danger red + Skull glyph).
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom size — slow fade (5 s)">
                                <div style={{ minHeight: 100 }}>
                                    {/* @ts-ignore */}
                                    <tc-hit-marker show crit size="72" duration="5000" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="tc-done event">
                                <div style={{ minHeight: 80 }}>
                                    {/* @ts-ignore */}
                                    <tc-hit-marker ref={eventRef} show size="36" duration="2000" />
                                </div>
                                <div className="form-text mt-2">
                                    {doneCount > 0 ? (
                                        <span className="text-success">
                                            ✓ <code>tc-done</code> fired {doneCount}× — the marker
                                            finished and cleared its <code>show</code> attribute.
                                        </span>
                                    ) : (
                                        <span>
                                            Waiting for <code>tc-done</code> (fires after 2 s)…
                                        </span>
                                    )}
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HitMarkerDemo
