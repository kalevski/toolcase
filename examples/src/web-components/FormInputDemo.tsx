import React, { useState } from 'react'
import { useTc, type TcRef } from '@toolcase/web-components/react'

// Listen for tc-change on a tc-form-input and surface the latest value + error.
function useFormValue(
    instanceProps: Record<string, unknown> = {},
): [{ value: unknown; hasError: boolean }, TcRef<HTMLElement>] {
    const [state, setState] = useState<{ value: unknown; hasError: boolean }>({
        value: '',
        hasError: false,
    })
    const ref = useTc<HTMLElement>(instanceProps, {
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent).detail
            setState({ value: detail.value, hasError: detail.hasError })
        },
    })

    return [state, ref]
}

const FormInputDemo: React.FC = () => {
    // Wire JS-property props (validate, options) that React can't set as attributes.
    const [emailState, emailRef] = useFormValue({
        validate: (value: unknown) => {
            const v = String(value ?? '')
            if (v === '') return true
            return /.+@.+\..+/.test(v) ? true : 'Enter a valid email address'
        },
    })
    const dropdownRef = useTc<HTMLElement>({
        options: [
            { value: 'us', label: 'United States' },
            { value: 'gb', label: 'United Kingdom' },
            { value: 'mk', label: 'North Macedonia' },
            { value: 'jp', label: 'Japan' },
        ],
    })
    const radioRef = useTc<HTMLElement>({
        options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
        ],
        defaultValue: 'medium',
    })
    const disabledRef = useTc<HTMLElement>({ value: 'Locked value' })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Form Input"
                            description="Universal form-input dispatcher — one element renders any of 18 control types with built-in validation, helper/error lines, and full ARIA wiring."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Text with validation (validate property)">
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
                                        value: {String(emailState.value)} — hasError:{' '}
                                        {String(emailState.hasError)}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Dropdown (options property)">
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
                            </tc-section-card>

                            <tc-section-card title="Radio group (options property)">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input ref={radioRef} type="radio" label="Priority" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Checkbox & switch">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="checkbox"
                                        label="I accept the terms"
                                        required
                                    />
                                    {/* @ts-ignore */}
                                    <tc-form-input type="switch" label="Enable notifications" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Date, color & range">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="date"
                                        label="Start date"
                                        help="Pick a launch date."
                                    />
                                    {/* @ts-ignore */}
                                    <tc-form-input type="color" label="Brand color" />
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="range"
                                        label="Volume"
                                        min="0"
                                        max="100"
                                        step="5"
                                        help="Drag to adjust."
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Forced error & loading state">
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
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        ref={disabledRef}
                                        type="text"
                                        label="Read-only field"
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

export default FormInputDemo
