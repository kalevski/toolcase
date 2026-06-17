import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TIPS = [
    'Compiling shaders…',
    'Loading assets…',
    'Connecting to server…',
    'Initialising scene…',
]

const LoadingOverlayDemo: React.FC = () => {
    // ── Indeterminate (no progress) ───────────────────────────────────────────
    const [openBasic, setOpenBasic] = useState(false)

    // ── Determinate with label + progress ────────────────────────────────────
    const [openDet, setOpenDet] = useState(false)
    const [progress, setProgress] = useState(0)
    const detRef = useRef<any>(null)

    useEffect(() => {
        const el = detRef.current
        if (!el) return
        el.open = openDet
        el.label = 'Loading assets'
        el.tip = TIPS[Math.floor(progress * TIPS.length) % TIPS.length]
        el.progress = progress
    }, [openDet, progress])

    // Simulate progress ticking forward while the overlay is open
    useEffect(() => {
        if (!openDet) {
            setProgress(0)
            return
        }
        const id = setInterval(() => {
            setProgress(p => {
                const next = parseFloat((p + 0.05).toFixed(2))
                if (next >= 1) {
                    setOpenDet(false)
                    return 0
                }
                return next
            })
        }, 200)
        return () => clearInterval(id)
    }, [openDet])

    // ── Label only (no progress value, no tip) ────────────────────────────────
    const [openLabel, setOpenLabel] = useState(false)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Loading Overlay"
                            description="Full-surface loading overlay with a spinner ring, optional label, determinate or indeterminate progress bar, and an optional mono tip line. Ported from gc-loading-overlay and restyled to the toolcase design system — flat slate ink scrim, sharp panel, no game chrome."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Indeterminate spinner">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    When <code>progress</code> is absent the bar animates
                                    indeterminately. Toggle <code>[open]</code> to show or hide.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setOpenBasic(v => !v)}
                                >
                                    {openBasic ? 'Close overlay' : 'Open overlay'}
                                </button>
                                {/* @ts-ignore */}
                                <tc-loading-overlay
                                    {...(openBasic ? { open: '' } : {})}
                                />
                            </SectionCard>

                            <SectionCard title="Determinate with label + tip">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Pass a <code>progress</code> value between <code>0</code> and{' '}
                                    <code>1</code> for a determinate bar with a percentage readout.
                                    A <code>tip</code> attribute shows a mono status line below the bar.
                                    This demo auto-advances the progress and closes when it reaches 100&nbsp;%.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setOpenDet(true)}
                                    disabled={openDet}
                                >
                                    Start loading
                                </button>
                                {/* @ts-ignore */}
                                <tc-loading-overlay ref={detRef} />
                            </SectionCard>

                            <SectionCard title="Label without progress">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    A <code>label</code> attribute with no <code>progress</code>{' '}
                                    shows the indeterminate bar alongside a descriptive label.
                                    No percentage is displayed since progress is unknown.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setOpenLabel(v => !v)}
                                >
                                    {openLabel ? 'Close overlay' : 'Open overlay'}
                                </button>
                                {/* @ts-ignore */}
                                <tc-loading-overlay
                                    label="Connecting to server…"
                                    {...(openLabel ? { open: '' } : {})}
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoadingOverlayDemo
