import React, { useState } from 'react'
import { useTc, type TcRef } from '@toolcase/web-components/react'

function useRatingValue(initial: number): [number, TcRef<HTMLElement>] {
    const [value, setValue] = useState<number>(initial)
    const ref = useTc<HTMLElement>(
        { value },
        {
            'tc-change': (e: Event) => {
                const detail = (e as CustomEvent).detail
                if (typeof detail?.value === 'number') setValue(detail.value)
            },
        }
    )

    return [value, ref]
}

const RatingDemo: React.FC = () => {
    const [v1, ref1] = useRatingValue(3)
    const [v2, ref2] = useRatingValue(2.5)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Rating"
                            description="Interactive star rating with optional half-stars, keyboard navigation, custom icons, size variants, and a read-only display mode."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Interactive — tc-change listener">
                                <div className="d-flex align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-rating ref={ref1} count="5"></tc-rating>
                                    <span className="form-text m-0">Selected: {v1} of 5</span>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Half-stars (allow-half)">
                                <div className="d-flex align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-rating ref={ref2} count="5" allow-half></tc-rating>
                                    <span className="form-text m-0">Selected: {v2} of 5</span>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Read-only">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-rating value="4" count="5" read-only></tc-rating>
                                    {/* @ts-ignore */}
                                    <tc-rating
                                        value="3.5"
                                        count="5"
                                        allow-half
                                        read-only
                                    ></tc-rating>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom icon (heart)">
                                {/* @ts-ignore */}
                                <tc-rating value="3" count="5" icon="heart"></tc-rating>
                            </tc-section-card>

                            <tc-section-card title="Size variants">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-rating value="3" count="5" size="small"></tc-rating>
                                    {/* @ts-ignore */}
                                    <tc-rating value="3" count="5" size="default"></tc-rating>
                                    {/* @ts-ignore */}
                                    <tc-rating value="3" count="5" size="large"></tc-rating>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RatingDemo
