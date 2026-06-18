import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useSliderValue(initial: number): [number, boolean, React.RefObject<any>] {
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

const wellStyle = { maxWidth: 520, border: '1px solid var(--tc-border)' }

const SettingSliderDemo: React.FC = () => {
    const [vol, muted, refVol] = useSliderValue(0.8)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Setting Slider"
                            description="A generic range-slider setting row: a native range input paired with a mono readout, plus an optional mute button. The readout format is driven by `format` (percent / int / float + unit). tc-volume-slider, tc-deadzone-slider and tc-fov-slider are presets."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Generic (0–100, integer)">
                                <div style={wellStyle}>
                                    {/* @ts-ignore */}
                                    <tc-setting-slider row-label="Render scale" value="100" min="50" max="200" step="5" format="int" unit="%" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Volume preset (with mute, percent)">
                                <div style={wellStyle}>
                                    {/* @ts-ignore */}
                                    <tc-volume-slider ref={refVol} value="0.8" />
                                </div>
                                <div className="form-text mt-1">
                                    Current: {Math.round(vol * 100)}% {muted ? '(muted)' : ''}
                                </div>
                            </SectionCard>

                            <SectionCard title="Deadzone preset (percent)">
                                <div style={wellStyle}>
                                    {/* @ts-ignore */}
                                    <tc-deadzone-slider row-label="Left stick deadzone" description="Ignore input below this threshold." value="0.15" />
                                </div>
                            </SectionCard>

                            <SectionCard title="FOV preset (integer degrees)">
                                <div style={wellStyle}>
                                    {/* @ts-ignore */}
                                    <tc-fov-slider row-label="Field of View" min="70" max="140" value="103" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={wellStyle}>
                                    {/* @ts-ignore */}
                                    <tc-volume-slider row-label="Sound effects" description="Locked — connect a device first." value="0.7" disabled />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingSliderDemo
