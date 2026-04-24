import React from 'react'
import {
    BundleBar,
    Icon,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
} from '@toolcase/react-components'

const BundleBarDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
                    title="BundleBar"
                    description="Segmented progress bar with optional filter chips and a name/meta footer. Useful for bundle size, feature availability, or quota usage."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="With chips and meta">
                        <BundleBar
                            chips={[
                                { label: 'JS', active: true, icon: <Icon name="filetype-js" /> },
                                { label: 'CSS', icon: <Icon name="filetype-css" /> },
                                { label: 'Assets', icon: <Icon name="box-seam" /> },
                            ]}
                            segments={16}
                            filledSegments={9}
                            name="app.main.js"
                            meta="280 KB / 512 KB gzipped"
                        />
                    </SectionCard>

                    <SectionCard title="Minimal — bar only">
                        <BundleBar segments={20} filledSegments={14} />
                    </SectionCard>

                    <SectionCard title="Empty (0 filled)">
                        <BundleBar
                            segments={12}
                            filledSegments={0}
                            name="new bundle"
                            meta="no data yet"
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default BundleBarDemo
