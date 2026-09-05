import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const SECTIONS = [
    { role: 'Direction', names: ['Aldric Vane', 'Brina Storm'] },
    { role: 'Engineering', names: ['Caelum Brook', 'Dorin Hale', 'Eira Wynne'] },
    { role: 'Art', names: ['Faelyn Reed', 'Garrick Ash'] },
    { role: 'Sound', names: ['Hesper Lane'] },
    { role: 'Special Thanks', names: ['Ironwood Studio', 'The Cartographers Guild'] },
]

const CreditsScrollDemo: React.FC = () => {
    const [status, setStatus] = useState('scrolling…')

    const ref = useTc<HTMLElement>(
        { sections: SECTIONS },
        { 'tc-complete': () => setStatus('complete') }
    )
    const fastRef = useTc<HTMLElement>({ sections: SECTIONS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CreditsScroll"
                            description="Auto-scrolling end-credits sequence. Click or press Space/Enter to pause and play; fires tc-complete when the track passes the viewport."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card
                                title={`Default — sections via JS property (status: ${status})`}
                            >
                                <div style={{ height: 320, maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-credits-scroll
                                        ref={ref}
                                        speed="40"
                                        scroll-title="Toolcase Studio"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Faster scroll, no title">
                                <div style={{ height: 280, maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-credits-scroll
                                        ref={fastRef}
                                        speed="90"
                                        style={
                                            {
                                                '--bs-credits-scroll-min-height': '280px',
                                            } as React.CSSProperties
                                        }
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CreditsScrollDemo
