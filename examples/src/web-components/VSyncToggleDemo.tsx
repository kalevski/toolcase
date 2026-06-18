import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useVSyncValue(initial: boolean): [boolean, React.RefObject<any>] {
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

const VSyncToggleDemo: React.FC = () => {
    const [v1, ref1] = useVSyncValue(false)
    const [v2, ref2] = useVSyncValue(true)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="VSync Toggle"
                            description="A vsync on/off setting row: a label/description block paired with a pill-track switch. Built on the shared tc-setting-row scaffold; defaults its label to 'V-Sync'."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — off, defaults to 'V-Sync'">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-vsync-toggle ref={ref1} />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v1)}</div>
                            </SectionCard>

                            <SectionCard title="Checked + custom label & description">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-vsync-toggle
                                        ref={ref2}
                                        row-label="Vertical sync"
                                        description="Synchronise the frame rate with the display refresh rate to eliminate tearing."
                                        checked
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v2)}</div>
                            </SectionCard>

                            <SectionCard title="Disabled (off)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-vsync-toggle
                                        row-label="V-Sync"
                                        description="Unavailable when G-Sync or FreeSync is active."
                                        disabled
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled (on)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-vsync-toggle
                                        row-label="V-Sync"
                                        description="Forced on by the current display profile."
                                        checked
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

export default VSyncToggleDemo
