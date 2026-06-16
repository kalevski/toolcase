import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useFullscreenValue(initial: boolean): [boolean, React.RefObject<any>] {
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

const FullscreenToggleDemo: React.FC = () => {
    const [v1, ref1] = useFullscreenValue(false)
    const [v2, ref2] = useFullscreenValue(true)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Fullscreen Toggle"
                            description="A fullscreen on/off setting row: a label/description block paired with a pill-track switch. Built on the shared tc-setting-row scaffold; defaults its label to 'Fullscreen'."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — off, defaults to 'Fullscreen'">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle ref={ref1} />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v1)}</div>
                            </SectionCard>

                            <SectionCard title="Checked + custom label & description">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle
                                        ref={ref2}
                                        row-label="Borderless fullscreen"
                                        description="Run the game at the desktop resolution without a window frame."
                                        checked
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {String(v2)}</div>
                            </SectionCard>

                            <SectionCard title="Disabled (off)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle
                                        row-label="Fullscreen"
                                        description="Locked while the game is running in safe mode."
                                        disabled
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled (on)">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fullscreen-toggle
                                        row-label="Fullscreen"
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

export default FullscreenToggleDemo
