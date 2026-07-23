import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const PRESET_HEX = [
    '#0f172a',
    '#1e293b',
    '#334155',
    '#475569',
    '#64748b',
    '#94a3b8',
    '#cbd5e1',
    '#f1f5f9',
    '#dc2626',
    '#ea580c',
    '#d97706',
    '#ca8a04',
    '#16a34a',
    '#0284c7',
    '#7c3aed',
    '#db2777',
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
    const [hexValue, setHexValue] = useState('#334155')
    const [optionsValue, setOptionsValue] = useState('#dc2626')

    const hexRef = useTc<HTMLElement>(
        { colors: PRESET_HEX, value: hexValue },
        { 'tc-change': (e: Event) => setHexValue((e as CustomEvent).detail.value) }
    )
    const optionsRef = useTc<HTMLElement>(
        { colors: PRESET_OPTIONS, value: optionsValue },
        { 'tc-change': (e: Event) => setOptionsValue((e as CustomEvent).detail.value) }
    )
    const columnsRef = useTc<HTMLElement>({ colors: PRESET_HEX })
    const loadingRef = useTc<HTMLElement>({ colors: [] })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ColorPicker"
                            description="Color picker dropdown with preset swatch grid, hex input, and selection management."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Hex string array">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={hexRef} label="Background color" />
                                    <div className="form-text mt-2">Selected: {hexValue}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="ColorOption[] with labels">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={optionsRef} label="Accent color" />
                                    <div className="form-text mt-2">Selected: {optionsValue}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom columns (4)">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker
                                        ref={columnsRef}
                                        label="Theme color"
                                        columns="4"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker ref={loadingRef} label="Loading…" loading />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker
                                        label="Disabled picker"
                                        value="#64748b"
                                        disabled
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No label">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-color-picker value="#0284c7" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ColorPickerDemo
