import React, { useEffect, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const ComboCounterDemo: React.FC = () => {
    const [combo, setCombo] = useState(3)
    const [timer, setTimer] = useState(1)

    // Drive the live readout's combo + draining timer through JS properties.
    const liveRef = useTc<HTMLElement>({ combo, timer })

    // Drain the timer bar; reset the combo when it empties.
    useEffect(() => {
        const id = window.setInterval(() => {
            setTimer((prev) => {
                const next = prev - 0.05
                if (next <= 0) {
                    setCombo(0)
                    return 1
                }
                return next
            })
        }, 150)
        return () => window.clearInterval(id)
    }, [])

    const hit = () => {
        setCombo((prev) => prev + 1)
        setTimer(1)
    }

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ComboCounter"
                            description="Combo / multiplier HUD readout — a mono label, a large ink multiplier figure, and an optional draining timer bar. The readout only appears once a multiplier is building (combo > 1)."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Building multiplier">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="5" />
                            </tc-section-card>

                            <tc-section-card title="Custom label">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="12" label="Streak" />
                            </tc-section-card>

                            <tc-section-card title="With timer bar">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="8" timer="0.6" />
                            </tc-section-card>

                            <tc-section-card title="Custom figure size">
                                {/* @ts-ignore */}
                                <tc-combo-counter
                                    combo="20"
                                    label="Mega"
                                    font-size="56"
                                    timer="0.85"
                                />
                            </tc-section-card>

                            <tc-section-card title="Hidden below x2">
                                <p className="text-muted small mb-2">
                                    A combo of <code>1</code> renders nothing — there is no card
                                    below.
                                </p>
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="1" />
                            </tc-section-card>

                            <tc-section-card title="Interactive — rack up hits before the timer drains">
                                <div className="d-flex align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-combo-counter ref={liveRef} label="Combo" timer="1" />
                                    <tc-button onClick={hit}>Hit</tc-button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Row of readouts">
                                <div className="d-flex flex-wrap gap-3 align-items-start">
                                    {/* @ts-ignore */}
                                    <tc-combo-counter combo="2" />
                                    {/* @ts-ignore */}
                                    <tc-combo-counter combo="7" label="Chain" timer="0.4" />
                                    {/* @ts-ignore */}
                                    <tc-combo-counter combo="33" label="Frenzy" timer="0.95" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ComboCounterDemo
