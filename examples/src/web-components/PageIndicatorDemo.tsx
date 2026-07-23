import React, { useEffect, useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const PageIndicatorDemo: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0)
    const interactiveRef = useTcEvents<HTMLElement>({
        'tc-select': (e: Event) => {
            const ce = e as CustomEvent<{ index: number }>
            setActiveIndex(ce.detail.index)
        },
    })

    useEffect(() => {
        if (interactiveRef.current) {
            interactiveRef.current.setAttribute('index', String(activeIndex))
        }
    }, [activeIndex])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Page Indicator"
                            description="Dot page-navigation widget. Fires tc-select with { index } when a dot is clicked."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (5 pages, index 2)">
                                {/* @ts-ignore */}
                                <tc-page-indicator count="5" index="2" />
                            </tc-section-card>

                            <tc-section-card title="Interactive — click a dot">
                                <div className="d-flex align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-page-indicator ref={interactiveRef} count="7" index="0" />
                                    <span
                                        style={{
                                            fontFamily: 'var(--bs-font-monospace)',
                                            fontSize: 12,
                                        }}
                                    >
                                        page {activeIndex + 1} / 7
                                    </span>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom size &amp; gap">
                                {/* @ts-ignore */}
                                <tc-page-indicator count="6" index="3" size="12" gap="12px" />
                            </tc-section-card>

                            <tc-section-card title="Custom colors">
                                {/* @ts-ignore */}
                                <tc-page-indicator
                                    count="5"
                                    index="1"
                                    color="var(--tc-border)"
                                    active-color="var(--tc-accent)"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PageIndicatorDemo
