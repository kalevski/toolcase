import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const OPTIONS = [
    { value: 'js', label: 'JavaScript' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'py', label: 'Python' },
    { value: 'go', label: 'Go', disabled: true },
]

const CheckboxGroupDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const inlineRef = useRef<any>(null)
    const controlledRef = useRef<any>(null)
    const requiredRef = useRef<any>(null)

    const [selection, setSelection] = useState<string[]>([])
    const [controlledValue, setControlledValue] = useState<string[]>(['js', 'ts'])

    useEffect(() => {
        const els = [basicRef, inlineRef, requiredRef].map(r => r.current)
        els.forEach(el => {
            if (el) el.options = OPTIONS
        })
    }, [])

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: string[] }>).detail
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
            const detail = (e as CustomEvent<{ value: string[] }>).detail
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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CheckboxGroup"
                            description="Coordinated group of checkboxes with optional label, inline layout, disabled options, and controlled/uncontrolled value."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default (labelled group, with disabled option)">
                                {/* @ts-ignore */}
                                <tc-checkbox-group ref={basicRef} label="Preferred languages" name="languages" />
                                {selection.length > 0 && (
                                    <div className="form-text mt-2">
                                        Selected: {selection.join(', ')}
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard title="Inline layout">
                                {/* @ts-ignore */}
                                <tc-checkbox-group ref={inlineRef} label="Preferred languages" name="languages-inline" inline />
                            </SectionCard>

                            <SectionCard title="Controlled value">
                                {/* @ts-ignore */}
                                <tc-checkbox-group ref={controlledRef} label="Controlled selection" name="languages-controlled" />
                                <div className="form-text mt-2">
                                    Controlled value: {controlledValue.length ? controlledValue.join(', ') : '(none)'}
                                </div>
                                <div className="d-flex gap-2 mt-2">
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setControlledValue(['ts'])}>
                                        Set TypeScript only
                                    </button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setControlledValue([])}>
                                        Clear all
                                    </button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Required (aria-invalid when empty)">
                                {/* @ts-ignore */}
                                <tc-checkbox-group ref={requiredRef} label="Select at least one" name="languages-required" required />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CheckboxGroupDemo
