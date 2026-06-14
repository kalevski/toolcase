import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PhoneInputDemo: React.FC = () => {
    const defaultRef = useRef<any>(null)
    const gbRef = useRef<any>(null)
    const errorRef = useRef<any>(null)
    const formRef = useRef<any>(null)

    const [defaultValue, setDefaultValue] = useState('')
    const [gbValue, setGbValue] = useState('')

    useEffect(() => {
        const el = defaultRef.current
        if (!el) return
        const handler = (e: Event) => {
            setDefaultValue((e as CustomEvent<{ value: string }>).detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = gbRef.current
        if (!el) return
        const handler = (e: Event) => {
            setGbValue((e as CustomEvent<{ value: string }>).detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PhoneInput"
                            description="International phone input with a searchable country selector, dial-code prefix, and form submission support."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default (United States)">
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
                            </SectionCard>

                            <SectionCard title="Pre-selected country (United Kingdom)">
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
                            </SectionCard>

                            <SectionCard title="Error state">
                                {/* @ts-ignore */}
                                <tc-phone-input
                                    ref={errorRef}
                                    label="Phone number"
                                    default-country="US"
                                    value="+1555"
                                    error="Please enter a valid phone number."
                                />
                            </SectionCard>

                            <SectionCard title="Inside a form (with name attribute)">
                                {/* @ts-ignore */}
                                <tc-phone-input
                                    ref={formRef}
                                    label="Contact number"
                                    name="phone"
                                    default-country="US"
                                    placeholder="(555) 000-0000"
                                />
                                <div className="form-text mt-2">
                                    A hidden <code>&lt;input name=&quot;phone&quot;&gt;</code> carries the full
                                    value (dial code + number) for native form submission.
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PhoneInputDemo
