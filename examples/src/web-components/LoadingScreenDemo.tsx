import React, { useEffect, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const TIPS = [
    'Compiling shaders…',
    'Loading assets…',
    'Connecting to server…',
    'Initialising scene…',
    'Resolving dependencies…',
]

const LoadingScreenDemo: React.FC = () => {
    // ── Indeterminate (no progress) ───────────────────────────────────────────
    const [showBasic, setShowBasic] = useState(false)

    // ── Determinate with cycling tips ─────────────────────────────────────────
    const [showDet, setShowDet] = useState(false)
    const [progress, setProgress] = useState(0)
    const detRef = useTc<HTMLElement>({ tips: TIPS, tipInterval: 1500 })

    // Simulate progress advancing and auto-close at 100 %
    useEffect(() => {
        if (!showDet) {
            setProgress(0)
            return
        }
        const id = setInterval(() => {
            setProgress((p) => {
                const next = parseFloat((p + 0.04).toFixed(2))
                if (next >= 1) {
                    setShowDet(false)
                    return 0
                }
                return next
            })
        }, 150)
        return () => clearInterval(id)
    }, [showDet])

    // ── Indeterminate with tips only ──────────────────────────────────────────
    const [showTips, setShowTips] = useState(false)
    const tipsRef = useTc<HTMLElement>({ tips: TIPS, tipInterval: 2000 })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Loading Screen"
                            description="Full-viewport loading screen with an eyebrow label, optional title, progress bar (determinate or indeterminate), and a cycling tip section. Ported from gc-loading-screen and voiced for the web-components design system — slate surface, sharp corners, no game chrome."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Indeterminate">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Without a <code>progress</code> attribute the bar animates
                                    indeterminately. Click to add <code>tc-loading-screen</code> to
                                    the DOM; the component covers the viewport until dismissed.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowBasic(true)}
                                    disabled={showBasic}
                                >
                                    Show loading screen
                                </button>

                                {showBasic && (
                                    <>
                                        {/* @ts-ignore */}
                                        <tc-loading-screen
                                            eyebrow="Loading"
                                            title-text="Preparing your workspace"
                                        />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '2rem',
                                                right: '2rem',
                                                zIndex: 1060,
                                            }}
                                        >
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowBasic(false)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Determinate with tips">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Pass a <code>progress</code> value between <code>0</code> and{' '}
                                    <code>1</code> for a determinate bar with a percentage readout.
                                    Set the <code>tips</code> JS property to an array of strings for
                                    rotating tip text; <code>tip-interval</code> controls the
                                    rotation speed in milliseconds. This demo auto-advances to 100 %
                                    and closes.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowDet(true)}
                                    disabled={showDet}
                                >
                                    Start loading
                                </button>

                                {showDet && (
                                    /* @ts-ignore */
                                    <tc-loading-screen
                                        ref={detRef}
                                        eyebrow="Loading"
                                        title-text="Building your project"
                                        label="Compiling assets"
                                        progress={progress}
                                        tip-title="Did you know"
                                    />
                                )}
                            </tc-section-card>

                            <tc-section-card title="Indeterminate with cycling tips">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Tips cycle automatically even without a determinate progress
                                    value. Set the <code>tips</code> JS property to an array of
                                    strings and optionally adjust <code>tip-interval</code>.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowTips(true)}
                                    disabled={showTips}
                                >
                                    Show with tips
                                </button>

                                {showTips && (
                                    <>
                                        {/* @ts-ignore */}
                                        <tc-loading-screen
                                            ref={tipsRef}
                                            eyebrow="Initialising"
                                            title-text="Please wait"
                                            tip-title="Tip"
                                        />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '2rem',
                                                right: '2rem',
                                                zIndex: 1060,
                                            }}
                                        >
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowTips(false)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoadingScreenDemo
