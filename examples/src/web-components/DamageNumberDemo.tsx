import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const DamageNumberDemo: React.FC = () => {
    // The numbers play their rise-and-fade once then sit at opacity 0; bumping
    // this key remounts the elements so the animation can be watched again.
    const [replayKey, setReplayKey] = useState(0)

    const [doneCount, setDoneCount] = useState(0)
    const eventRef = useTcEvents<HTMLElement>({ 'tc-done': () => setDoneCount((c) => c + 1) })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Damage Number"
                            description="A floating combat number that rises and fades over a configurable duration, then fires tc-done. Re-skinned to the toolcase voice — JetBrains Mono digits in the slate/status palette."
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
                                Replay animations
                            </button>
                        </div>

                        <div className="d-flex flex-column gap-4 mt-4" key={replayKey}>
                            <tc-section-card title="Variants">
                                <div
                                    className="d-flex align-items-center gap-5"
                                    style={{ minHeight: 80 }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-damage-number value="42" duration="3000" />
                                    {/* @ts-ignore */}
                                    <tc-damage-number value="128" crit duration="3000" />
                                    {/* @ts-ignore */}
                                    <tc-damage-number value="35" heal duration="3000" />
                                    {/* @ts-ignore */}
                                    <tc-damage-number miss duration="3000" />
                                </div>
                                <div className="form-text mt-2">
                                    Normal · <code>crit</code> (larger, danger red) ·{' '}
                                    <code>heal</code> (green, <code>+</code> prefix) ·{' '}
                                    <code>miss</code> (muted uppercase).
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom duration — slow rise (5 s)">
                                <div style={{ minHeight: 80 }}>
                                    {/* @ts-ignore */}
                                    <tc-damage-number value="999" crit duration="5000" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="tc-done event">
                                <div style={{ minHeight: 80 }}>
                                    {/* @ts-ignore */}
                                    <tc-damage-number ref={eventRef} value="7" duration="2000" />
                                </div>
                                <div className="form-text mt-2">
                                    {doneCount > 0 ? (
                                        <span className="text-success">
                                            ✓ <code>tc-done</code> fired {doneCount}× — the number
                                            finished its animation.
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

export default DamageNumberDemo
