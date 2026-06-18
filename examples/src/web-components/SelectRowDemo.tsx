import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useSelectRowValue(initial: string): [string, React.RefObject<any>] {
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

const QUALITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'ultra', label: 'Ultra' },
]

const LANG_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' },
]

const SHADOW_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'low', label: 'Low' },
    { value: 'high', label: 'High' },
]

const SelectRowDemo: React.FC = () => {
    const [v1, ref1] = useSelectRowValue('high')
    const [v2, ref2] = useSelectRowValue('en')

    // Populate options via JS property (not attribute).
    useEffect(() => {
        if (ref1.current) ref1.current.options = QUALITY_OPTIONS
        if (ref2.current) ref2.current.options = LANG_OPTIONS
    }, [])

    // Custom options for the third and fourth examples.
    const ref3 = useRef<any>(null)
    const ref4 = useRef<any>(null)
    useEffect(() => {
        const el = ref3.current
        if (!el) return
        el.options = [
            { value: '1', label: '1 (Minimum)' },
            { value: '2', label: '2' },
            { value: '4', label: '4' },
            { value: '8', label: '8 (Default)' },
            { value: '16', label: '16 (Maximum)' },
        ]
    }, [])

    useEffect(() => {
        if (ref4.current) ref4.current.options = SHADOW_OPTIONS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Select Row"
                            description="A generic labeled dropdown setting row: a label/description block paired with a native select. Built on the shared tc-setting-row scaffold."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Quality preset">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref1}
                                        row-label="Texture quality"
                                        description="Controls the resolution of in-game textures."
                                        value="high"
                                    />
                                </div>
                                <div className="form-text mt-1">Current: {v1}</div>
                            </SectionCard>

                            <SectionCard title="Language picker">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref2}
                                        row-label="Language"
                                        description="Select the interface language."
                                        value="en"
                                    />
                                </div>
                                <div className="form-text mt-1">Current: {v2}</div>
                            </SectionCard>

                            <SectionCard title="Numeric options">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref3}
                                        row-label="Anisotropic filtering"
                                        description="Higher values improve texture sharpness at oblique angles."
                                        value="8"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref4}
                                        row-label="Shadow quality"
                                        description="Locked while cinematic mode is active."
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

export default SelectRowDemo
