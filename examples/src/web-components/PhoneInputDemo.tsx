import React, { useRef, useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const PhoneInputDemo: React.FC = () => {
    const errorRef = useRef<any>(null)
    const formRef = useRef<any>(null)

    const [defaultValue, setDefaultValue] = useState('')
    const [gbValue, setGbValue] = useState('')

    const defaultRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            setDefaultValue((e as CustomEvent<{ value: string }>).detail.value)
        },
    })
    const gbRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            setGbValue((e as CustomEvent<{ value: string }>).detail.value)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PhoneInput"
                            description="International phone input with a searchable country selector, dial-code prefix, and form submission support."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (United States)">
                                {/* @ts-ignore */}
                                <tc-phone-input
                                    ref={defaultRef}
                                    label="Phone number"
                                    default-country="US"
                                    placeholder="(555) 000-0000"
                                />
                                <div className="form-text mt-2">
                                    Value: <strong>{defaultValue || '(empty)'}</strong>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Pre-selected country (United Kingdom)">
                                {/* @ts-ignore */}
                                <tc-phone-input
                                    ref={gbRef}
                                    label="Phone number"
                                    default-country="GB"
                                    placeholder="07700 900 000"
                                />
                                <div className="form-text mt-2">
                                    Value: <strong>{gbValue || '(empty)'}</strong>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Error state">
                                {/* @ts-ignore */}
                                <tc-phone-input
                                    ref={errorRef}
                                    label="Phone number"
                                    default-country="US"
                                    value="+1555"
                                    error="Please enter a valid phone number."
                                />
                            </tc-section-card>

                            <tc-section-card title="Inside a form (with name attribute)">
                                {/* @ts-ignore */}
                                <tc-phone-input
                                    ref={formRef}
                                    label="Contact number"
                                    name="phone"
                                    default-country="US"
                                    placeholder="(555) 000-0000"
                                />
                                <div className="form-text mt-2">
                                    Form-associated via <code>ElementInternals</code> — the
                                    combined value (dial code + number) submits under{' '}
                                    <code>name="phone"</code> with no mirror input needed.
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PhoneInputDemo
