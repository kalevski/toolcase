import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function usePresetValue(initial: string): [string, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            if (detail) setValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Graphics Preset Picker"
                            description="A low / medium / high / ultra graphics-preset setting row: a label/description block paired with a segmented preset button group. Built on the shared tc-setting-row scaffold."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — four presets, defaults to 'Quality preset' / 'medium'">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-graphics-preset-picker ref={ref1} />
                                </div>
                                <div className="form-text mt-1">Current value: {v1}</div>
                            </SectionCard>

                            <SectionCard title="Custom label + description, preset 'ultra'">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-graphics-preset-picker
                                        ref={ref2}
                                        row-label="Graphics quality"
                                        description="Higher presets sharpen shadows and textures at the cost of frame rate."
                                        value="ultra"
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {v2}</div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-graphics-preset-picker
                                        row-label="Graphics quality"
                                        description="Locked while the benchmark is running."
                                        value="high"
                                        disabled
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GraphicsPresetPickerDemo
