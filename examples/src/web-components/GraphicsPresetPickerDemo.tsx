import React, { useState } from 'react'
import { useTcEvents, type TcRef } from '@toolcase/web-components/react'

function usePresetValue(initial: string): [string, TcRef<HTMLElement>] {
    const [value, setValue] = useState(initial)
    const ref = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            if (detail) setValue(detail.value)
        },
    })

    return [value, ref]
}

const GraphicsPresetPickerDemo: React.FC = () => {
    const [v1, ref1] = usePresetValue('medium')
    const [v2, ref2] = usePresetValue('ultra')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Graphics Preset Picker"
                            description="A low / medium / high / ultra graphics-preset setting row: a label/description block paired with a segmented preset button group. Built on the shared tc-setting-row scaffold."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — four presets, defaults to 'Quality preset' / 'medium'">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-graphics-preset-picker ref={ref1} />
                                </div>
                                <div className="form-text mt-1">Current value: {v1}</div>
                            </tc-section-card>

                            <tc-section-card title="Custom label + description, preset 'ultra'">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-graphics-preset-picker
                                        ref={ref2}
                                        row-label="Graphics quality"
                                        description="Higher presets sharpen shadows and textures at the cost of frame rate."
                                        value="ultra"
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {v2}</div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-graphics-preset-picker
                                        row-label="Graphics quality"
                                        description="Locked while the benchmark is running."
                                        value="high"
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

export default GraphicsPresetPickerDemo
