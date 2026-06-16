import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard, Button } from '@toolcase/react-components'

const ComboCounterDemo: React.FC = () => {
    const liveRef = useRef<any>(null)
    const [combo, setCombo] = useState(3)
    const [timer, setTimer] = useState(1)

    // Drive the live readout's combo + draining timer through JS properties.
    useEffect(() => {
        const el = liveRef.current
        if (!el) return
        el.combo = combo
        el.timer = timer
    }, [combo, timer])

    // Drain the timer bar; reset the combo when it empties.
    useEffect(() => {
        const id = window.setInterval(() => {
            setTimer(prev => {
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
        setCombo(prev => prev + 1)
        setTimer(1)
    }

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ComboCounter"
                            description="Combo / multiplier HUD readout — a mono label, a large ink multiplier figure, and an optional draining timer bar. The readout only appears once a multiplier is building (combo > 1)."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Building multiplier">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="5" />
                            </SectionCard>

                            <SectionCard title="Custom label">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="12" label="Streak" />
                            </SectionCard>

                            <SectionCard title="With timer bar">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="8" timer="0.6" />
                            </SectionCard>

                            <SectionCard title="Custom figure size">
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="20" label="Mega" font-size="56" timer="0.85" />
                            </SectionCard>

                            <SectionCard title="Hidden below x2">
                                <p className="text-muted small mb-2">
                                    A combo of <code>1</code> renders nothing — there is no card below.
                                </p>
                                {/* @ts-ignore */}
                                <tc-combo-counter combo="1" />
                            </SectionCard>

                            <SectionCard title="Interactive — rack up hits before the timer drains">
                                <div className="d-flex align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-combo-counter ref={liveRef} label="Combo" timer="1" />
                                    <Button onClick={hit}>Hit</Button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Row of readouts">
                                <div className="d-flex flex-wrap gap-3 align-items-start">
                                    {/* @ts-ignore */}
                                    <tc-combo-counter combo="2" />
                                    {/* @ts-ignore */}
                                    <tc-combo-counter combo="7" label="Chain" timer="0.4" />
                                    {/* @ts-ignore */}
                                    <tc-combo-counter combo="33" label="Frenzy" timer="0.95" />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ComboCounterDemo
