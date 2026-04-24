import React from 'react'
import {
    CdnMap,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
} from '@toolcase/react-components'

const CdnMapDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
                    title="CdnMap"
                    description="Decorative world-map dot plot for PoP/region visualisations. Accepts nodes positioned by percentage, with an optional accent variant."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default nodes">
                        <CdnMap
                            nodes={[
                                { top: '28%', left: '18%', label: 'San Francisco' },
                                { top: '32%', left: '48%', variant: 'accent', label: 'London' },
                                { top: '36%', left: '54%', label: 'Frankfurt' },
                                { top: '42%', left: '72%', label: 'Singapore' },
                                { top: '48%', left: '80%', variant: 'accent', label: 'Sydney' },
                                { top: '66%', left: '34%', label: 'São Paulo' },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title="Taller map, fewer nodes">
                        <CdnMap
                            height={220}
                            nodes={[
                                { top: '40%', left: '30%', variant: 'accent' },
                                { top: '50%', left: '60%' },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default CdnMapDemo
