import React, { useEffect, useRef, useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const PRESETS = [
    { id: 'under3', label: 'under 3 000', min: null, max: 3000 },
    { id: '3to7', label: '3 000 – 7 000', min: 3000, max: 7000 },
    { id: '7to15', label: '7 000 – 15 000', min: 7000, max: 15000 },
    { id: 'over15', label: 'over 15 000', min: 15000, max: null },
]

const RangeFieldDemo: React.FC = () => {
    const [span, setSpan] = useState<{ from: number | null; to: number | null }>({
        from: null,
        to: null,
    })
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        if (ref.current) (ref.current as never as { presets: unknown }).presets = PRESETS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="RangeField"
                            description="A from–to numeric pair with one-tap spans above it. Four filter sheets carried a numeric range and only one was complete."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Forms
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Presets, then digits">
                                <tc-range-field
                                    ref={ref}
                                    heading="Price (EUR)"
                                    bounds-min={450}
                                    bounds-max={68000}
                                    from={span.from ?? undefined}
                                    to={span.to ?? undefined}
                                    note="The placeholders are the real span of what is on the market right now."
                                    ontc-change={(e) =>
                                        setSpan({ from: e.detail.from, to: e.detail.to })
                                    }
                                />
                                <p style={note} className="mt-3">
                                    from <strong>{span.from ?? '—'}</strong> to{' '}
                                    <strong>{span.to ?? '—'}</strong>
                                </p>
                                <p style={note}>
                                    <strong>Not tc-range-slider.</strong> That is a drag control —
                                    two thumbs on a track, for a bounded span you feel your way
                                    along. This is a <em>typed</em> pair, for a span whose bounds
                                    are open at one end. A slider cannot express „no upper bound",
                                    and a phone thumb cannot land on a single year in a 40-year
                                    track.
                                </p>
                                <p style={note}>
                                    The inputs are uncontrolled, which is why the presets are a
                                    separate mechanism: typing is never rewritten mid-keystroke, and
                                    a preset changes the value from outside the inputs.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RangeFieldDemo
