import React, { useEffect, useRef, useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const YEARS = Array.from({ length: 12 }, (_, i) => ({
    value: String(2013 + i),
    label: String(2013 + i),
}))

const BODIES = [
    { value: 'hatch', label: 'Hatchback', count: 412 },
    { value: 'estate', label: 'Estate', count: 288 },
    { value: 'saloon', label: 'Saloon', count: 173 },
    { value: 'suv', label: 'SUV / crossover', count: 341 },
    { value: 'coupe', label: 'Coupé', count: 22, disabled: true },
]

const FacetPickerDemo: React.FC = () => {
    const [year, setYear] = useState('')
    const [body, setBody] = useState('')
    const yearRef = useRef<HTMLElement>(null)
    const bodyRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (yearRef.current) (yearRef.current as never as { options: unknown }).options = YEARS
        if (bodyRef.current) (bodyRef.current as never as { options: unknown }).options = BODIES
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FacetPicker"
                            description="One dimension of a narrowing pick, as a row of chips. Single-select, and re-tapping the picked chip clears the dimension."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Browse
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="rail — one scrolling line">
                                <tc-facet-picker
                                    ref={yearRef}
                                    label="Year"
                                    value={year}
                                    ontc-pick={(e) => setYear(e.detail.value ?? '')}
                                />
                                <p style={note} className="mt-3">
                                    picked: <strong>{year || '—'}</strong> · A 320px screen fits
                                    three or four year chips per line, so a wrapping row of twelve
                                    becomes three lines of chrome for <em>one</em> dimension. The
                                    rail keeps it to a single scrolling line, which is why it is the
                                    default.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="wrap — for options that are sentences">
                                <tc-facet-picker
                                    ref={bodyRef}
                                    layout="wrap"
                                    size="md"
                                    label="Body"
                                    hint="One shape at a time. Tap the picked chip again to clear it."
                                    value={body}
                                    ontc-pick={(e) => setBody(e.detail.value ?? '')}
                                />
                                <p style={note} className="mt-3">
                                    picked: <strong>{body || '—'}</strong> · There is no separate
                                    clear button: the chip already does it, and a ✕ beside it would
                                    be a second control for something the first one covers.
                                </p>
                                <p style={note}>
                                    The options are a <strong>property</strong>, not children. A
                                    chip element that moves its light-DOM children into its own
                                    wrapper turns a React-rendered label into a node React thinks it
                                    owns inside a subtree the element rewrites — and it goes blank
                                    the first time the selection flips.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FacetPickerDemo
