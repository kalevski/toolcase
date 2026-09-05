import React, { useEffect, useRef } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const ARCHETYPES = [
    { at: 45, label: 'family diesel' },
    { at: 75, label: 'modern turbo' },
    { at: 110, label: 'hot hatch' },
    { at: 180, label: 'supercar' },
]

const ValueInRangeDemo: React.FC = () => {
    const scale = useRef<HTMLElement>(null)

    useEffect(() => {
        if (scale.current) (scale.current as never as { anchors: unknown }).anchors = ARCHETYPES
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ValueInRange"
                            description="Where one figure sits inside a distribution. polovni.mk wrote this three times — SpecScale, PriceSpanRail and PriceRangeBars — and they are one element with three skins."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Data
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="scale — placed between familiar things">
                                <tc-value-in-range
                                    ref={scale}
                                    label="Power per litre"
                                    value="71 PS/l"
                                    at={71}
                                    caption="Around a modern turbo: unstressed enough to last, brisk enough not to feel slow."
                                />
                                <p style={note} className="mt-3">
                                    The first version of this used a four-band ladder —{' '}
                                    <em>relaxed · easy-going · strong · highly strung</em> — which
                                    is only readable by someone who already knows what 112 PS per
                                    litre means. The same track labelled{' '}
                                    <em>family diesel · modern turbo · hot hatch · supercar</em>{' '}
                                    answers „is that a lot?" without the reader learning anything
                                    first.
                                </p>
                                <p style={note}>
                                    The anchors are spread <strong>evenly</strong> and the track is
                                    a piecewise-linear map onto those positions. At their raw ratios
                                    three of four bunch into the left third and the fourth presses
                                    against the end, so the labels collide and the useful middle is
                                    a few pixels wide. Only the outer two keep a word; every anchor
                                    keeps its tick, and the full set stays in the track's{' '}
                                    <code>aria-label</code>.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="span — a floor, a ceiling, and a median on the rail">
                                <tc-value-in-range
                                    variant="span"
                                    tone="info"
                                    label="Asking price, this version, 2018"
                                    value="€8 400 – €13 900"
                                    min={8400}
                                    max={13900}
                                    median={10700}
                                    caption="42 cars on the market. The marker is the middle one."
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ValueInRangeDemo
