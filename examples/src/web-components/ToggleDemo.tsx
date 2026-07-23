import React, { useEffect, useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const ToggleDemo: React.FC = () => {
    const [isOn, setIsOn] = useState(false)

    // Sync the controlled toggle's on state with React state.
    const controlledRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            setIsOn((e as CustomEvent<{ on: boolean }>).detail.on)
        },
    })

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
                        <tc-rich-page-header
                            title-text="Toggle"
                            description="Atomic on/off switch — a standalone pill-track switch atom. The host IS the control: role=switch, keyboard accessible, fires tc-change on every flip. Use tc-toggle-card when you need a card wrapper around the switch."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Uncontrolled toggles">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-toggle label="Notifications off" />
                                    {/* @ts-ignore */}
                                    <tc-toggle on label="Notifications on" />
                                </div>
                            </tc-section-card>

                            <tc-section-card
                                title={`Controlled (currently: ${isOn ? 'on' : 'off'})`}
                            >
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-toggle ref={controlledRef} label="Controlled toggle" />
                                    <div className="d-flex gap-2">
                                        <button
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setIsOn(true)}
                                        >
                                            Turn on
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setIsOn(false)}
                                        >
                                            Turn off
                                        </button>
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-toggle disabled label="Disabled off" />
                                    {/* @ts-ignore */}
                                    <tc-toggle on disabled label="Disabled on" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Inline with text label">
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex align-items-center gap-3">
                                        {/* @ts-ignore */}
                                        <tc-toggle on label="Dark mode" />
                                        <span
                                            className="text-muted"
                                            style={{ fontSize: '0.925rem' }}
                                        >
                                            Dark mode
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                        {/* @ts-ignore */}
                                        <tc-toggle label="Auto-save" />
                                        <span
                                            className="text-muted"
                                            style={{ fontSize: '0.925rem' }}
                                        >
                                            Auto-save
                                        </span>
                                    </div>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ToggleDemo
