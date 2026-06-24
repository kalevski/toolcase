import React, { useEffect, useRef, useState } from 'react'

const OPTIONS = [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'angular', label: 'Angular', disabled: true },
]

const RadioGroupDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const inlineRef = useRef<any>(null)
    const controlledRef = useRef<any>(null)

    const [selection, setSelection] = useState<string>('')
    const [controlledValue, setControlledValue] = useState<string>('react')

    useEffect(() => {
        const els = [basicRef, inlineRef].map((r) => r.current)
        els.forEach((el) => {
            if (el) el.options = OPTIONS
        })
    }, [])

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            setSelection(detail.value)
            console.log('tc-change:', detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = controlledRef.current
        if (!el) return
        el.options = OPTIONS
        el.value = controlledValue

        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            setControlledValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = controlledRef.current
        if (el) el.value = controlledValue
    }, [controlledValue])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="RadioGroup"
                            description="Group of radio buttons with optional label, inline layout, disabled options, and controlled/uncontrolled value. Supports roving tabindex and arrow-key navigation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (labelled group, with disabled option)">
                                {/* @ts-ignore */}
                                <tc-radio-group
                                    ref={basicRef}
                                    label="Preferred framework"
                                    name="framework"
                                />
                                {selection && (
                                    <div className="form-text mt-2">Selected: {selection}</div>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Inline layout">
                                {/* @ts-ignore */}
                                <tc-radio-group
                                    ref={inlineRef}
                                    label="Preferred framework"
                                    name="framework-inline"
                                    inline
                                />
                            </tc-section-card>

                            <tc-section-card title="Controlled value">
                                {/* @ts-ignore */}
                                <tc-radio-group
                                    ref={controlledRef}
                                    label="Controlled selection"
                                    name="framework-controlled"
                                />
                                <div className="form-text mt-2">
                                    Controlled value: {controlledValue || '(none)'}
                                </div>
                                <div className="d-flex gap-2 mt-2">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setControlledValue('vue')}
                                    >
                                        Set Vue
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setControlledValue('svelte')}
                                    >
                                        Set Svelte
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setControlledValue('')}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RadioGroupDemo
