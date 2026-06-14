import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PRESET_HEX = [
    '#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#f1f5f9',
    '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#16a34a', '#0284c7', '#7c3aed', '#db2777',
]

const PRESET_OPTIONS = [
    { value: '#0f172a', label: 'Slate 900' },
    { value: '#1e293b', label: 'Slate 800' },
    { value: '#334155', label: 'Slate 700' },
    { value: '#475569', label: 'Slate 600' },
    { value: '#64748b', label: 'Slate 500' },
    { value: '#94a3b8', label: 'Slate 400' },
    { value: '#dc2626', label: 'Red' },
    { value: '#16a34a', label: 'Green' },
    { value: '#0284c7', label: 'Blue' },
    { value: '#7c3aed', label: 'Purple' },
    { value: '#db2777', label: 'Pink' },
    { value: '#d97706', label: 'Amber' },
]

const ColorPickerDemo: React.FC = () => {
    const hexRef = useRef<any>(null)
    const optionsRef = useRef<any>(null)
    const columnsRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)

    const [hexValue, setHexValue] = useState('#334155')
    const [optionsValue, setOptionsValue] = useState('#dc2626')

    useEffect(() => {
        const el = hexRef.current
        if (!el) return
        el.colors = PRESET_HEX
        el.value = hexValue
        const handler = (e: Event) => setHexValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = optionsRef.current
        if (!el) return
        el.colors = PRESET_OPTIONS
        el.value = optionsValue
        const handler = (e: Event) => setOptionsValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = columnsRef.current
        if (!el) return
        el.colors = PRESET_HEX
    }, [])

    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.colors = []
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ColorPicker"
                            description="Color picker dropdown with preset swatch grid, hex input, and selection management."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Hex string array">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={hexRef} label="Background color" />
                                    <div className="form-text mt-2">Selected: {hexValue}</div>
                                </div>
                            </SectionCard>

                            <SectionCard title="ColorOption[] with labels">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={optionsRef} label="Accent color" />
                                    <div className="form-text mt-2">Selected: {optionsValue}</div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom columns (4)">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={columnsRef} label="Theme color" columns="4" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading state">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={loadingRef} label="Loading…" loading />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker label="Disabled picker" value="#64748b" disabled />
                                </div>
                            </SectionCard>

                            <SectionCard title="No label">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker value="#0284c7" />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ColorPickerDemo
