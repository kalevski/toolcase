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

                            <tc-section-card title="Keyboard hints & the message gutter">
                                <p className="text-muted small mb-3">
                                    <code>inputmode</code> / <code>enterkeyhint</code> /{' '}
                                    <code>autocomplete</code> pass through, and <code>type</code>{' '}
                                    supplies the unambiguous defaults: <code>number</code> →{' '}
                                    <code>inputmode=&quot;decimal&quot;</code> (the decimal pad, not
                                    the PIN pad — wrong for every weight and portion),{' '}
                                    <code>search</code> →{' '}
                                    <code>enterkeyhint=&quot;search&quot;</code> +{' '}
                                    <code>autocomplete=&quot;off&quot;</code>, <code>email</code>/
                                    <code>tel</code>/<code>url</code> → their own pads.{' '}
                                    <code>password</code> gets no autocomplete default on purpose:{' '}
                                    <code>current-password</code> and <code>new-password</code> are
                                    opposite instructions and only the form knows which it is.
                                </p>
                                <p className="text-muted small mb-3">
                                    The reserved one-line message gutter is now OFF by default — it
                                    cost ~19px of invisible height under every field, which is a
                                    third of a control on a phone. <code>reserve-message</code>{' '}
                                    brings it back for a form grid that wants the alignment.
                                </p>
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="search"
                                        label="Барајте рецепт"
                                        placeholder='Барајте („tavce" → Тавче)'
                                    />
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="number"
                                        label="Тежина (г)"
                                        placeholder="250"
                                        step="0.1"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="email"
                                        label="Е-пошта"
                                        placeholder="ana@example.mk"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-form-input
                                        type="text"
                                        label="With the gutter reserved"
                                        placeholder="reserve-message"
                                        reserve-message
                                    />
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
