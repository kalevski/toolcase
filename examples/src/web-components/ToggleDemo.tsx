import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ToggleDemo: React.FC = () => {
    const controlledRef = useRef<any>(null)
    const [isOn, setIsOn] = useState(false)

    // Sync the controlled toggle's on state with React state.
    useEffect(() => {
        const el = controlledRef.current
        if (!el) return
        const handler = (e: Event) => {
            setIsOn((e as CustomEvent<{ on: boolean }>).detail.on)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = controlledRef.current
        if (el) {
            if (isOn) el.setAttribute('on', '')
            else el.removeAttribute('on')
        }
    }, [isOn])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Toggle"
                            description="Atomic on/off switch — a standalone pill-track switch atom. The host IS the control: role=switch, keyboard accessible, fires tc-change on every flip. Use tc-toggle-card when you need a card wrapper around the switch."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Uncontrolled toggles">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-toggle label="Notifications off" />
                                    {/* @ts-ignore */}
                                    <tc-toggle on label="Notifications on" />
                                </div>
                            </SectionCard>

                            <SectionCard title={`Controlled (currently: ${isOn ? 'on' : 'off'})`}>
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-toggle ref={controlledRef} label="Controlled toggle" />
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setIsOn(true)}>
                                            Turn on
                                        </button>
                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setIsOn(false)}>
                                            Turn off
                                        </button>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-toggle disabled label="Disabled off" />
                                    {/* @ts-ignore */}
                                    <tc-toggle on disabled label="Disabled on" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Inline with text label">
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex align-items-center gap-3">
                                        {/* @ts-ignore */}
                                        <tc-toggle on label="Dark mode" />
                                        <span className="text-muted" style={{ fontSize: '0.925rem' }}>Dark mode</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                        {/* @ts-ignore */}
                                        <tc-toggle label="Auto-save" />
                                        <span className="text-muted" style={{ fontSize: '0.925rem' }}>Auto-save</span>
                                    </div>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ToggleDemo
