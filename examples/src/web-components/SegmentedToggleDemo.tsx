import React, { useEffect, useRef, useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const CURRENCIES = [
    { value: 'EUR', label: 'EUR', description: 'Euro' },
    { value: 'MKD', label: 'MKD', description: 'Macedonian denar' },
]

const UNITS = [
    { value: 'km', label: 'km', description: 'Kilometres' },
    { value: 'mi', label: 'mi', description: 'Miles' },
]

const SegmentedToggleDemo: React.FC = () => {
    const [currency, setCurrency] = useState('EUR')
    const [unit, setUnit] = useState('km')
    const currencyRef = useRef<HTMLElement>(null)
    const unitRef = useRef<HTMLElement>(null)

    // `options` is an array, so it is a PROPERTY — react-dom would stringify it as
    // an attribute. This is exactly what useTc / the generated wrappers do for you.
    useEffect(() => {
        if (currencyRef.current)
            (currencyRef.current as never as { options: unknown }).options = CURRENCIES
        if (unitRef.current) (unitRef.current as never as { options: unknown }).options = UNITS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SegmentedToggle"
                            description="A binary (or short) global preference, as segments. polovni.mk wrote this twice — CurrencyToggle and LocaleToggle — differing only in the option list."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Forms
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Two options, both on screen">
                                <div className="d-flex gap-3 flex-wrap align-items-center">
                                    <tc-segmented-toggle
                                        ref={currencyRef}
                                        label="Currency"
                                        value={currency}
                                        ontc-change={(e) => setCurrency(e.detail.value)}
                                    />
                                    <tc-segmented-toggle
                                        ref={unitRef}
                                        size="sm"
                                        label="Distance"
                                        value={unit}
                                        ontc-change={(e) => setUnit(e.detail.value)}
                                    />
                                    <span className="text-body-secondary">
                                        {currency} · {unit}
                                    </span>
                                </div>
                                <p style={note} className="mt-3">
                                    Not a select: there are exactly two options, and a control whose
                                    whole option list fits on screen should not hide it behind a
                                    tap.
                                </p>
                                <p style={note}>
                                    It is a <code>radiogroup</code>, not a tablist — the selection
                                    is a <strong>value</strong>, not a view, and that is what a
                                    screen reader needs to announce „2 of 2" rather than „tab". The
                                    labels are codes, so the spoken name rides on each segment's{' '}
                                    <code>description</code>.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SegmentedToggleDemo
