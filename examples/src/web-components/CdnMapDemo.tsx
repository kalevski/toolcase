import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const CdnMapDemo: React.FC = () => {
    const mixedRef = useTc<HTMLElement>({
        nodes: [
            { top: '20%', left: '15%', variant: 'primary', label: 'NYC' },
            { top: '35%', left: '55%', variant: 'accent', label: 'AMS' },
            { top: '60%', left: '30%', variant: 'primary', label: 'LAX' },
            { top: '25%', left: '78%', variant: 'accent', label: 'SIN' },
            { top: '70%', left: '65%', variant: 'primary', label: 'SYD' },
        ],
    })
    const primaryOnlyRef = useTc<HTMLElement>({
        nodes: [
            { top: '30%', left: '20%', variant: 'primary', label: 'ORD' },
            { top: '50%', left: '50%', variant: 'primary', label: 'FRA' },
            { top: '70%', left: '75%', variant: 'primary', label: 'NRT' },
        ],
    })
    const accentOnlyRef = useTc<HTMLElement>({
        nodes: [
            { top: '25%', left: '40%', variant: 'accent', label: 'CDG' },
            { top: '65%', left: '60%', variant: 'accent', label: 'GRU' },
        ],
    })
    const tallRef = useTc<HTMLElement>({
        nodes: [
            { top: '10%', left: '10%', variant: 'primary', label: 'SEA' },
            { top: '30%', left: '45%', variant: 'accent', label: 'LHR' },
            { top: '55%', left: '25%', variant: 'primary', label: 'MIA' },
            { top: '75%', left: '70%', variant: 'primary', label: 'HKG' },
            { top: '45%', left: '80%', variant: 'accent', label: 'BOM' },
            { top: '85%', left: '50%', variant: 'primary', label: 'JNB' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CdnMap"
                            description="Grid-backed surface with positioned CDN node markers. Primary nodes use the slate ink accent; accent (cyan) nodes are used sparingly for highlight PoPs. Set nodes via the JS nodes property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Mixed primary and accent nodes">
                                {/* @ts-ignore */}
                                <tc-cdn-map ref={mixedRef} height="240" />
                            </tc-section-card>

                            <tc-section-card title="Primary nodes only">
                                {/* @ts-ignore */}
                                <tc-cdn-map ref={primaryOnlyRef} height="200" />
                            </tc-section-card>

                            <tc-section-card title="Accent nodes only (highlight PoPs)">
                                {/* @ts-ignore */}
                                <tc-cdn-map ref={accentOnlyRef} height="200" />
                            </tc-section-card>

                            <tc-section-card title="Tall map with CSS height string">
                                {/* @ts-ignore */}
                                <tc-cdn-map ref={tallRef} height="360px" />
                            </tc-section-card>

                            <tc-section-card title="Empty map">
                                {/* @ts-ignore */}
                                <tc-cdn-map height="160" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CdnMapDemo
