import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DividerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Divider"
                        description="Horizontal or vertical 1px hairline separator, optionally with a centered mono micro-label."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Plain horizontal">
                            {/* @ts-ignore */}
                            <tc-divider></tc-divider>
                        </SectionCard>

                        <SectionCard title="Labelled horizontal (attribute)">
                            {/* @ts-ignore */}
                            <tc-divider label="Section"></tc-divider>
                        </SectionCard>

                        <SectionCard title="Labelled horizontal (slotted children)">
                            {/* @ts-ignore */}
                            <tc-divider>or</tc-divider>
                        </SectionCard>

                        <SectionCard title="Vertical divider between inline content">
                            <div className="d-flex align-items-center gap-3" style={{ height: '2rem' }}>
                                <span>Left</span>
                                {/* @ts-ignore */}
                                <tc-divider vertical></tc-divider>
                                <span>Right</span>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default DividerDemo
