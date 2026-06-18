import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useToggleRowValue(initial: boolean): [boolean, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: boolean }>).detail
            if (detail) setValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return [value, ref]
}

const ToggleRowDemo: React.FC = () => {
    const [v1, ref1] = useToggleRowValue(false)
    const [v2, ref2] = useToggleRowValue(true)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Toggle Row"
                            description="A generic labeled boolean toggle setting row: a label/description block paired with a pill-track switch. Built on the shared tc-setting-row scaffold. Port of gc-toggle-row."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — off">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-row ref={ref1} row-label="Enable notifications" />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v1)}</div>
                            </SectionCard>

                            <SectionCard title="Checked + description">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-row
                                        ref={ref2}
                                        row-label="Auto-save"
                                        description="Automatically save your progress every 5 minutes."
                                        checked
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v2)}</div>
                            </SectionCard>

                            <SectionCard title="Disabled (off)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-row
                                        row-label="Hardware cursor"
                                        description="Locked while the game is running in compatibility mode."
                                        disabled
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled (on)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-row
                                        row-label="Show FPS counter"
                                        description="Forced on by the current diagnostic profile."
                                        checked
                                        disabled
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Setting presets (just a row-label)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-row row-label="V-Sync" checked />
                                    {/* @ts-ignore */}
                                    <tc-toggle-row row-label="Invert Y axis" />
                                </div>
                                <div className="form-text mt-1">
                                    The former tc-vsync-toggle / tc-invert-axis-toggle presets are just tc-toggle-row with a fixed row-label.
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ToggleRowDemo
