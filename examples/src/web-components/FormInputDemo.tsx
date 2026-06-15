import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// Listen for tc-change on a tc-form-input and surface the latest value + error.
function useFormValue(): [{ value: unknown; hasError: boolean }, React.RefObject<any>] {
    const [state, setState] = useState<{ value: unknown; hasError: boolean }>({ value: '', hasError: false })
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setState({ value: detail.value, hasError: detail.hasError })
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return [state, ref]
}

const FormInputDemo: React.FC = () => {
    const [emailState, emailRef] = useFormValue()
    const dropdownRef = useRef<any>(null)
    const radioRef = useRef<any>(null)
    const disabledRef = useRef<any>(null)

    // Wire JS-property props (validate, options) that React can't set as attributes.
    useEffect(() => {
        if (emailRef.current) {
            emailRef.current.validate = (value: unknown) => {
                const v = String(value ?? '')
                if (v === '') return true
                return /.+@.+\..+/.test(v) ? true : 'Enter a valid email address'
            }
        }
        if (dropdownRef.current) {
            dropdownRef.current.options = [
                { value: 'us', label: 'United States' },
                { value: 'gb', label: 'United Kingdom' },
                { value: 'mk', label: 'North Macedonia' },
                { value: 'jp', label: 'Japan' },
            ]
        }
        if (radioRef.current) {
            radioRef.current.options = [
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
            ]
            radioRef.current.defaultValue = 'medium'
        }
        if (disabledRef.current) {
            disabledRef.current.value = 'Locked value'
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Form Input"
                            description="Universal form-input dispatcher — one element renders any of 18 control types with built-in validation, helper/error lines, and full ARIA wiring."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Text with validation (validate property)">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        ref={emailRef}
                                        type="email"
                                        label="Email address"
                                        help="We'll never share your email."
                                        placeholder="you@example.com"
                                        required
                                    />
                                    <div className="form-text mt-1">
                                        value: {String(emailState.value)} — hasError: {String(emailState.hasError)}
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Dropdown (options property)">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        ref={dropdownRef}
                                        type="dropdown"
                                        label="Country"
                                        placeholder="Select a country"
                                        help="Choose where you're based."
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Radio group (options property)">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input ref={radioRef} type="radio" label="Priority" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Checkbox & switch">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input type="checkbox" label="I accept the terms" required />
                                    {/* @ts-ignore */}
                                    <tc-form-input type="switch" label="Enable notifications" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Date, color & range">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input type="date" label="Start date" help="Pick a launch date." />
                                    {/* @ts-ignore */}
                                    <tc-form-input type="color" label="Brand color" />
                                    {/* @ts-ignore */}
                                    <tc-form-input type="range" label="Volume" min="0" max="100" step="5" help="Drag to adjust." />
                                </div>
                            </SectionCard>

                            <SectionCard title="Forced error & loading state">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="text"
                                        label="Username"
                                        error="This username is already taken"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-form-input type="text" label="Loading field" loading />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input ref={disabledRef} type="text" label="Read-only field" disabled />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FormInputDemo
