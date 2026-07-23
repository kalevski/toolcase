import React, { useState } from 'react'
import { useTcEvents, type TcRef } from '@toolcase/web-components/react'

function useFullscreenValue(initial: boolean): [boolean, TcRef<HTMLElement>] {
    const [value, setValue] = useState(initial)
    const ref = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent<{ value: boolean }>).detail
            if (detail) setValue(detail.value)
        },
    })

    return [value, ref]
}

const FullscreenToggleDemo: React.FC = () => {
    const [v1, ref1] = useFullscreenValue(false)
    const [v2, ref2] = useFullscreenValue(true)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Fullscreen Toggle"
                            description="A fullscreen on/off setting row: a label/description block paired with a pill-track switch. Built on the shared tc-setting-row scaffold; defaults its label to 'Fullscreen'."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — off, defaults to 'Fullscreen'">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle ref={ref1} />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v1)}</div>
                            </tc-section-card>

                            <tc-section-card title="Checked + custom label & description">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle
                                        ref={ref2}
                                        row-label="Borderless fullscreen"
                                        description="Run the game at the desktop resolution without a window frame."
                                        checked
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v2)}</div>
                            </tc-section-card>

                            <tc-section-card title="Disabled (off)">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle
                                        row-label="Fullscreen"
                                        description="Locked while the game is running in safe mode."
                                        disabled
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled (on)">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle
                                        row-label="Fullscreen"
                                        description="Forced on by the current display profile."
                                        checked
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

export default FullscreenToggleDemo
