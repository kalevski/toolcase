import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const VERSIONS = [
    { label: 'v3.2', value: '3.2', latest: true },
    { label: 'v3.1', value: '3.1' },
    { label: 'v2.8', value: '2.8', lts: true },
    { label: 'v1.4', value: '1.4', deprecated: true },
]

const VersionPickerDemo: React.FC = () => {
    const [selection, setSelection] = useState<string>('3.2')

    function handleChange(e: Event) {
        const detail = (e as CustomEvent<{ value: string }>).detail
        setSelection(detail.value)
        // Keep both controls in sync so the demo reads as one selection
        ;[segmentedRef.current, dropdownRef.current].filter(Boolean).forEach((el: any) => {
            if (el.value !== detail.value) el.value = detail.value
        })
    }

    const segmentedRef = useTc<HTMLElement>(
        { versions: VERSIONS, value: '3.2' },
        { 'tc-change': handleChange }
    )
    const dropdownRef = useTc<HTMLElement>(
        { versions: VERSIONS, value: '3.2' },
        { 'tc-change': handleChange }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="VersionPicker"
                            description="Version selector rendered as a segmented button group or a native-style dropdown. Versions carry latest / LTS / deprecated annotations and emit tc-change on selection."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Segmented (latest / LTS / deprecated, arrow-key navigation)">
                                {/* @ts-ignore */}
                                <tc-version-picker
                                    ref={segmentedRef}
                                    variant="segmented"
                                    name="version"
                                />
                                <div className="form-text mt-2">
                                    Selected: <code>{selection}</code>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Dropdown (native select with annotations)">
                                {/* @ts-ignore */}
                                <tc-version-picker
                                    ref={dropdownRef}
                                    variant="dropdown"
                                    name="version-dd"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VersionPickerDemo
