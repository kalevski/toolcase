import React, { useRef } from 'react'

let _counter = 0

const ShakeContainerDemo: React.FC = () => {
    const lightRef = useRef<any>(null)
    const heavyRef = useRef<any>(null)
    const imperativeRef = useRef<any>(null)

    const trigger = (ref: React.RefObject<any>) => {
        const el = ref.current
        if (!el) return
        _counter++
        el.setAttribute('trigger', String(_counter))
    }

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Shake Container"
                            description="rAF-driven camera-shake wrapper. Re-shakes whenever the trigger attribute changes to a new value; amplitude decays linearly from intensity px down to 0 over duration ms. Ported from gc-shake-container and restyled to the toolcase design system — no Shadow DOM, no game chrome, purely structural."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Light shake (intensity=4, duration=250)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Default settings give a subtle, quick jolt — suitable for minor
                                    hits or UI feedback. Click the button to re-trigger the shake.
                                </p>
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => trigger(lightRef)}
                                    >
                                        Shake
                                    </button>
                                    {/* @ts-ignore */}
                                    <tc-shake-container ref={lightRef} intensity="4" duration="250">
                                        <div
                                            style={{
                                                padding: '1rem 1.5rem',
                                                background: 'var(--tc-surface)',
                                                border: '1px solid var(--tc-border)',
                                                fontFamily:
                                                    'var(--tc-font-mono, "JetBrains Mono", monospace)',
                                                fontSize: '0.875rem',
                                                color: 'var(--tc-app-accent)',
                                                minWidth: 160,
                                            }}
                                        >
                                            -42 HP
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-shake-container>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Heavy shake (intensity=14, duration=600)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    High <code>intensity</code> and a longer <code>duration</code>
                                    give a dramatic camera-slam effect — suitable for boss hits or
                                    explosive events.
                                </p>
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => trigger(heavyRef)}
                                    >
                                        Boss slam
                                    </button>
                                    {/* @ts-ignore */}
                                    <tc-shake-container
                                        ref={heavyRef}
                                        intensity="14"
                                        duration="600"
                                    >
                                        <div
                                            style={{
                                                padding: '1rem 1.5rem',
                                                background: 'var(--tc-surface)',
                                                border: '1px solid var(--tc-border)',
                                                fontFamily:
                                                    'var(--tc-font-mono, "JetBrains Mono", monospace)',
                                                fontSize: '0.875rem',
                                                color: 'var(--tc-danger, #dc2626)',
                                                minWidth: 200,
                                            }}
                                        >
                                            CRITICAL HIT
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-shake-container>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Imperative shake() API">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Call <code>el.shake()</code> directly from JS without changing
                                    the <code>trigger</code> attribute — useful when the shake is
                                    driven by an event outside the attribute lifecycle.
                                </p>
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => imperativeRef.current?.shake()}
                                    >
                                        el.shake()
                                    </button>
                                    {/* @ts-ignore */}
                                    <tc-shake-container
                                        ref={imperativeRef}
                                        intensity="8"
                                        duration="400"
                                    >
                                        <div
                                            style={{
                                                padding: '1rem 1.5rem',
                                                background: 'var(--tc-surface)',
                                                border: '1px solid var(--tc-border)',
                                                fontFamily:
                                                    'var(--tc-font-mono, "JetBrains Mono", monospace)',
                                                fontSize: '0.875rem',
                                                color: 'var(--tc-text)',
                                                minWidth: 180,
                                            }}
                                        >
                                            Shake me imperatively
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-shake-container>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ShakeContainerDemo
