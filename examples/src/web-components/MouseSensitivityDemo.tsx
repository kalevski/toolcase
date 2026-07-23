import React, { useState } from 'react'
import { useTcEvents, type TcRef } from '@toolcase/web-components/react'

function useMouseSensitivity(initial: number): [number, TcRef] {
    const [value, setValue] = useState(initial)
    const ref = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent<{ key: string; value: number }>).detail
            if (detail && detail.key === 'main') setValue(detail.value)
        },
    })

    return [value, ref]
}

const MouseSensitivityDemo: React.FC = () => {
    const [v1, ref1] = useMouseSensitivity(1)
    const [v2, ref2] = useMouseSensitivity(1.5)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Mouse Sensitivity"
                            description="A mouse-sensitivity setting row: a label/description block paired with one or two range sliders (main + optional ADS) and mono decimal readouts. Built on the shared tc-setting-row scaffold."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — Main only, defaults to 1.00">
                                <div
                                    style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-mouse-sensitivity ref={ref1} value="1" />
                                </div>
                                <div className="form-text mt-1">Current main: {v1.toFixed(2)}</div>
                            </tc-section-card>

                            <tc-section-card title="With ADS slider">
                                <div
                                    style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-mouse-sensitivity
                                        ref={ref2}
                                        row-label="Mouse sensitivity"
                                        description="Adjust how quickly the camera reacts to mouse movement."
                                        value="1.5"
                                        ads="0.8"
                                    />
                                </div>
                                <div className="form-text mt-1">Current main: {v2.toFixed(2)}</div>
                            </tc-section-card>

                            <tc-section-card title="Custom label + description">
                                <div
                                    style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-mouse-sensitivity
                                        row-label="Look sensitivity"
                                        description="Controls how fast the camera rotates with the mouse."
                                        value="2"
                                        ads="1.2"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div
                                    style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-mouse-sensitivity
                                        row-label="Mouse sensitivity"
                                        description="Locked while the tutorial is active."
                                        value="1"
                                        ads="0.75"
                                        disabled
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MouseSensitivityDemo
