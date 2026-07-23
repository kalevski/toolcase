import React, { useState } from 'react'
import { useTc, type TcRef } from '@toolcase/web-components/react'

function useSelectRowValue(initial: string, options: unknown[]): [string, TcRef<HTMLElement>] {
    const [value, setValue] = useState(initial)
    const ref = useTc<HTMLElement>(
        { options },
        {
            'tc-change': (e: Event) => {
                const detail = (e as CustomEvent<{ value: string }>).detail
                if (detail) setValue(detail.value)
            },
        }
    )

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

const ANISO_OPTIONS = [
    { value: '1', label: '1 (Minimum)' },
    { value: '2', label: '2' },
    { value: '4', label: '4' },
    { value: '8', label: '8 (Default)' },
    { value: '16', label: '16 (Maximum)' },
]

const SelectRowDemo: React.FC = () => {
    const [v1, ref1] = useSelectRowValue('high', QUALITY_OPTIONS)
    const [v2, ref2] = useSelectRowValue('en', LANG_OPTIONS)

    const ref3 = useTc<HTMLElement>({ options: ANISO_OPTIONS })
    const ref4 = useTc<HTMLElement>({ options: SHADOW_OPTIONS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Select Row"
                            description="A generic labeled dropdown setting row: a label/description block paired with a native select. Built on the shared tc-setting-row scaffold."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Quality preset">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref1}
                                        row-label="Texture quality"
                                        description="Controls the resolution of in-game textures."
                                        value="high"
                                    />
                                </div>
                                <div className="form-text mt-1">Current: {v1}</div>
                            </tc-section-card>

                            <tc-section-card title="Language picker">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref2}
                                        row-label="Language"
                                        description="Select the interface language."
                                        value="en"
                                    />
                                </div>
                                <div className="form-text mt-1">Current: {v2}</div>
                            </tc-section-card>

                            <tc-section-card title="Numeric options">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref3}
                                        row-label="Anisotropic filtering"
                                        description="Higher values improve texture sharpness at oblique angles."
                                        value="8"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-select-row
                                        ref={ref4}
                                        row-label="Shadow quality"
                                        description="Locked while cinematic mode is active."
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

export default SelectRowDemo
