import React, { useEffect, useRef, useState } from 'react'

const NumberInputDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const stepRef = useRef<any>(null)
    const prefixRef = useRef<any>(null)
    const errorRef = useRef<any>(null)

    const [basicValue, setBasicValue] = useState<number | ''>(5)
    const [stepValue, setStepValue] = useState<number | ''>(0)
    const [prefixValue, setPrefixValue] = useState<number | ''>(100)

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.value = 5
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: number | '' }>).detail
            setBasicValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = stepRef.current
        if (!el) return
        el.value = 0
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: number | '' }>).detail
            setStepValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = prefixRef.current
        if (!el) return
        el.value = 100
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: number | '' }>).detail
            setPrefixValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="NumberInput"
                            description="Controlled numeric input with increment/decrement steppers, arrow-key support, min/max clamping, precision formatting, and optional prefix/suffix addons."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — min / max / step">
                                <div style={{ maxWidth: 260 }}>
                                    {/* @ts-ignore */}
                                    <tc-number-input
                                        ref={basicRef}
                                        label="Quantity"
                                        min="0"
                                        max="20"
                                        step="1"
                                    />
                                    <div className="form-text mt-1">
                                        Committed value:{' '}
                                        <strong>
                                            {basicValue === '' ? '(empty)' : basicValue}
                                        </strong>
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Step + Precision (temperature, 0.5 °C)">
                                <div style={{ maxWidth: 260 }}>
                                    {/* @ts-ignore */}
                                    <tc-number-input
                                        ref={stepRef}
                                        label="Temperature (°C)"
                                        min="-20"
                                        max="40"
                                        step="0.5"
                                        precision="1"
                                    />
                                    <div className="form-text mt-1">
                                        Committed value:{' '}
                                        <strong>{stepValue === '' ? '(empty)' : stepValue}</strong>
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Prefix / Suffix addons">
                                <div style={{ maxWidth: 280 }}>
                                    {/* @ts-ignore */}
                                    <tc-number-input
                                        ref={prefixRef}
                                        label="Budget"
                                        prefix="$"
                                        suffix="USD"
                                        min="0"
                                        step="10"
                                        precision="2"
                                    />
                                    <div className="form-text mt-1">
                                        Committed value:{' '}
                                        <strong>
                                            {prefixValue === '' ? '(empty)' : prefixValue}
                                        </strong>
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Error state">
                                <div style={{ maxWidth: 260 }}>
                                    {/* @ts-ignore */}
                                    <tc-number-input
                                        ref={errorRef}
                                        label="Age"
                                        min="18"
                                        max="120"
                                        value="16"
                                        error="Must be at least 18"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No label">
                                <div style={{ maxWidth: 180 }}>
                                    {/* @ts-ignore */}
                                    <tc-number-input min="0" max="100" value="42" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NumberInputDemo
