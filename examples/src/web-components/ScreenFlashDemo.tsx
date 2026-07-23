import React, { useRef, useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

let _counter = 0

const ScreenFlashDemo: React.FC = () => {
    // ── Default white flash ───────────────────────────────────────────────────
    const [defaultDone, setDefaultDone] = useState<number | null>(null)
    const defaultRef = useTcEvents<HTMLElement>({
        'tc-done': () => setDefaultDone(Date.now()),
    })

    // ── Red damage flash ──────────────────────────────────────────────────────
    const redRef = useRef<any>(null)

    // ── Slow cyan flash (custom duration + opacity) ───────────────────────────
    const slowRef = useRef<any>(null)

    // ── Imperative flash() API ────────────────────────────────────────────────
    const imperativeRef = useRef<any>(null)

    const triggerFlash = (ref: { current: any }) => {
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
                            title-text="Screen Flash"
                            description="Full-screen flash effect for damage hits and scene transitions. A fill div animates from a peak opacity back to transparent over a configurable duration. Ported from gc-screen-flash and restyled to the toolcase design system — flat fill, no game chrome, pointer-events disabled so it never blocks interaction."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (white, 200 ms)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    The default flash is a white screen-flash at full opacity fading
                                    out over 200&nbsp;ms. A <code>tc-done</code> event fires when
                                    the fade completes.
                                </p>
                                {defaultDone != null && (
                                    <p
                                        className="mb-3"
                                        style={{
                                            fontFamily:
                                                'var(--tc-font-mono, "JetBrains Mono", monospace)',
                                            fontSize: '0.8125rem',
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        tc-done fired ✓
                                    </p>
                                )}
                                <button
                                    className="btn btn-primary"
                                    onClick={() => triggerFlash(defaultRef)}
                                >
                                    Trigger flash
                                </button>
                                {/* @ts-ignore */}
                                <tc-screen-flash ref={defaultRef} />
                            </tc-section-card>

                            <tc-section-card title="Red damage flash (flash-color + flash-opacity)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Pass <code>flash-color</code> any CSS color value.{' '}
                                    <code>flash-opacity</code> controls the peak opacity (0–1,
                                    default 1); here it is set to <code>0.6</code> for a subtler hit
                                    effect.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => triggerFlash(redRef)}
                                >
                                    Trigger red flash
                                </button>
                                {/* @ts-ignore */}
                                <tc-screen-flash
                                    ref={redRef}
                                    flash-color="#dc2626"
                                    flash-opacity="0.6"
                                    duration="300"
                                />
                            </tc-section-card>

                            <tc-section-card title='Slow cyan flash (duration="800")'>
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    <code>duration</code> is in milliseconds (default 200). A longer
                                    duration suits cut-scene transitions; a shorter one suits hit
                                    reactions. Here 800&nbsp;ms with{' '}
                                    <code>var(--tc-app-accent)</code> gives a slow cyan fade.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => triggerFlash(slowRef)}
                                >
                                    Trigger slow flash
                                </button>
                                {/* @ts-ignore */}
                                <tc-screen-flash
                                    ref={slowRef}
                                    flash-color="var(--tc-app-accent)"
                                    flash-opacity="0.45"
                                    duration="800"
                                />
                            </tc-section-card>

                            <tc-section-card title="Imperative flash() API">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Call <code>el.flash()</code> directly from JS without changing
                                    the <code>trigger</code> attribute — useful when the flash is
                                    driven by an event outside the attribute lifecycle.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => imperativeRef.current?.flash()}
                                >
                                    el.flash()
                                </button>
                                {/* @ts-ignore */}
                                <tc-screen-flash
                                    ref={imperativeRef}
                                    flash-color="#f59e0b"
                                    flash-opacity="0.5"
                                    duration="400"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScreenFlashDemo
