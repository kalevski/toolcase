import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useVolumeValue(initial: number): [number, boolean, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const [muted, setMuted] = useState(false)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const onchange = (e: Event) => {
            const detail = (e as CustomEvent<{ value: number }>).detail
            if (detail) setValue(detail.value)
        }
        const ontoggle = () => {
            setMuted(m => {
                const next = !m
                // Reflect the toggled state back into the element.
                if (el) el.muted = next
                return next
            })
        }

        el.addEventListener('tc-change', onchange)
        el.addEventListener('tc-toggle-mute', ontoggle)
        return () => {
            el.removeEventListener('tc-change', onchange)
            el.removeEventListener('tc-toggle-mute', ontoggle)
        }
    }, [])

    return [value, muted, ref]
}

const VolumeSliderDemo: React.FC = () => {
    const [v1, muted1, ref1] = useVolumeValue(0.8)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Volume Slider"
                            description="A volume setting row: a mute toggle button, a 0–100% range slider, and a mono percentage readout. Built on the shared tc-setting-row scaffold. Port of game-components gc-volume-slider with the fantasy chrome dropped for the toolcase slate/ink look."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — Volume 80%, unmuted">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-volume-slider ref={ref1} value="0.8" />
                                </div>
                                <div className="form-text mt-1">
                                    Current: {Math.round(v1 * 100)}% {muted1 ? '(muted)' : ''}
                                </div>
                            </SectionCard>

                            <SectionCard title="With description, starts muted">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-volume-slider
                                        row-label="Master volume"
                                        description="Controls the overall game audio level."
                                        value="0.6"
                                        muted
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom label — Music">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-volume-slider
                                        row-label="Music"
                                        description="Background music volume."
                                        value="0.5"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-volume-slider
                                        row-label="Sound effects"
                                        description="Locked — connect a device first."
                                        value="0.7"
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

export default VolumeSliderDemo
