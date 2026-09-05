import React, { useRef, useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const OTPInputDemo: React.FC = () => {
    const lengthRef = useRef<any>(null)
    const errorRef = useRef<any>(null)

    const [numericValue, setNumericValue] = useState('')
    const [numericComplete, setNumericComplete] = useState(false)
    const [alphaValue, setAlphaValue] = useState('')
    const [maskedValue, setMaskedValue] = useState('')

    const numericRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            setNumericValue(detail.value)
            setNumericComplete(false)
        },
        'tc-complete': (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            setNumericValue(detail.value)
            setNumericComplete(true)
        },
    })

    const alphaRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            setAlphaValue(detail.value)
        },
    })

    const maskedRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            setMaskedValue(detail.value)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="OTPInput"
                            description="One-time-password input with per-digit cells, paste support, keyboard navigation, and masked mode."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Numeric (default, 6 digits)">
                                {/* @ts-ignore */}
                                <tc-otp-input
                                    ref={numericRef}
                                    label="Verification code"
                                    mode="numeric"
                                />
                                <div className="form-text mt-2">
                                    Value: <strong>{numericValue || '(empty)'}</strong>
                                    {numericComplete && (
                                        <span className="ms-2 text-success">✓ Complete</span>
                                    )}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Alphanumeric mode">
                                {/* @ts-ignore */}
                                <tc-otp-input
                                    ref={alphaRef}
                                    label="Invite code"
                                    mode="alphanumeric"
                                    length="8"
                                />
                                <div className="form-text mt-2">
                                    Value: <strong>{alphaValue || '(empty)'}</strong>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Masked (password cells)">
                                {/* @ts-ignore */}
                                <tc-otp-input
                                    ref={maskedRef}
                                    label="PIN"
                                    mode="numeric"
                                    length="4"
                                    masked
                                />
                                <div className="form-text mt-2">
                                    Committed value: <strong>{maskedValue || '(empty)'}</strong>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom length (8 digits)">
                                {/* @ts-ignore */}
                                <tc-otp-input
                                    ref={lengthRef}
                                    label="Backup code"
                                    mode="alphanumeric"
                                    length="8"
                                    value="AB12CD"
                                />
                            </tc-section-card>

                            <tc-section-card title="Error state">
                                {/* @ts-ignore */}
                                <tc-otp-input
                                    ref={errorRef}
                                    label="Verification code"
                                    mode="numeric"
                                    value="123456"
                                    error="Incorrect code. Please try again."
                                />
                            </tc-section-card>

                            <tc-section-card title="With form name (form-associated submission)">
                                {/* @ts-ignore */}
                                <tc-otp-input
                                    label="One-time code"
                                    mode="numeric"
                                    name="otp_code"
                                />
                                <div className="form-text mt-2">
                                    Form-associated via <code>ElementInternals</code> — the
                                    combined value submits under <code>name="otp_code"</code> with
                                    no mirror input needed.
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default OTPInputDemo
