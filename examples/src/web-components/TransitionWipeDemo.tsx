import React, { useEffect, useRef, useState } from 'react'
import type { TransitionWipeDirection } from '@toolcase/web-components'

const directions: TransitionWipeDirection[] = ['fade', 'left', 'right', 'up', 'down', 'iris']

const TransitionWipeDemo: React.FC = () => {
    // ── Primary interactive demo ──────────────────────────────────────────────
    const wipeRef = useRef<any>(null)
    const [completeCount, setCompleteCount] = useState(0)
    const [lastDirection, setLastDirection] = useState<TransitionWipeDirection>('fade')
    const [running, setRunning] = useState(false)

    useEffect(() => {
        const el = wipeRef.current
        if (!el) return
        const onComplete = () => {
            setCompleteCount((c) => c + 1)
            setRunning(false)
            // Remove [show] after a brief pause so the fill can animate back out.
            setTimeout(() => el.removeAttribute('show'), 300)
        }
        el.addEventListener('tc-complete', onComplete)
        return () => el.removeEventListener('tc-complete', onComplete)
    }, [])

    const fire = (d: TransitionWipeDirection) => {
        const el = wipeRef.current
        if (!el || running) return
        setLastDirection(d)
        setRunning(true)
        el.setAttribute('direction', d)
        el.setAttribute('show', '')
    }

    // ── Custom color demo ─────────────────────────────────────────────────────
    const colorRef = useRef<any>(null)
    const [colorRunning, setColorRunning] = useState(false)

    useEffect(() => {
        const el = colorRef.current
        if (!el) return
        const onComplete = () => {
            setColorRunning(false)
            setTimeout(() => el.removeAttribute('show'), 300)
        }
        el.addEventListener('tc-complete', onComplete)
        return () => el.removeEventListener('tc-complete', onComplete)
    }, [])

    // ── Slow long wipe ────────────────────────────────────────────────────────
    const slowRef = useRef<any>(null)
    const [slowRunning, setSlowRunning] = useState(false)

    useEffect(() => {
        const el = slowRef.current
        if (!el) return
        const onComplete = () => {
            setSlowRunning(false)
            setTimeout(() => el.removeAttribute('show'), 400)
        }
        el.addEventListener('tc-complete', onComplete)
        return () => el.removeEventListener('tc-complete', onComplete)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Transition Wipe"
                            description="Full-screen scene-wipe transition overlay. Six direction variants (fade, left, right, up, down, iris) are driven by the direction attribute; the [show] attribute triggers the wipe and a tc-complete event fires after duration ms. Ported from gc-transition-wipe and restyled to the toolcase design system — flat ink fill, no fantasy chrome, pointer-events blocked during the wipe."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Direction variants">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Click a direction to trigger the wipe. The fill animates in, a{' '}
                                    <code>tc-complete</code> event fires after <code>duration</code>{' '}
                                    ms (default 400 ms), then <code>[show]</code> is removed and the
                                    fill animates back out.
                                </p>
                                <div className="d-flex flex-wrap gap-2 mb-3">
                                    {directions.map((d) => (
                                        <button
                                            key={d}
                                            className="btn btn-primary"
                                            onClick={() => fire(d)}
                                            disabled={running}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                                {completeCount > 0 && (
                                    <p
                                        style={{
                                            fontFamily:
                                                'var(--tc-font-mono, "JetBrains Mono", monospace)',
                                            fontSize: '0.8125rem',
                                            color: 'var(--tc-text-muted)',
                                            marginBottom: 0,
                                        }}
                                    >
                                        tc-complete fired {completeCount}× (last: {lastDirection})
                                    </p>
                                )}
                                {/* @ts-ignore */}
                                <tc-transition-wipe ref={wipeRef} duration="400" />
                            </tc-section-card>

                            <tc-section-card title="Custom wipe-color (slate accent)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    <code>wipe-color</code> accepts any CSS color or custom
                                    property. Here it is set to <code>var(--tc-app-accent)</code>{' '}
                                    (the design system ink accent) for a branded wipe.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        const el = colorRef.current
                                        if (!el || colorRunning) return
                                        setColorRunning(true)
                                        el.setAttribute('show', '')
                                    }}
                                    disabled={colorRunning}
                                >
                                    Trigger accent wipe
                                </button>
                                {/* @ts-ignore */}
                                <tc-transition-wipe
                                    ref={colorRef}
                                    direction="down"
                                    duration="500"
                                    wipe-color="var(--tc-app-accent)"
                                />
                            </tc-section-card>

                            <tc-section-card title="Long duration (800 ms)">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Longer <code>duration</code> values suit cinematic cut-scenes;
                                    shorter values suit hit reactions. Here an iris wipe runs for
                                    800&nbsp;ms with the default ink color.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        const el = slowRef.current
                                        if (!el || slowRunning) return
                                        setSlowRunning(true)
                                        el.setAttribute('show', '')
                                    }}
                                    disabled={slowRunning}
                                >
                                    Trigger slow iris wipe
                                </button>
                                {/* @ts-ignore */}
                                <tc-transition-wipe ref={slowRef} direction="iris" duration="800" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TransitionWipeDemo
