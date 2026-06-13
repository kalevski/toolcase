import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BasicCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="BasicCard"
                            description="Small dashboard card with an optional icon chip and a two-line text block."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="With icon">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-basic-card icon="BarChart2" text-a="$24,500" text-b="Total revenue this month" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Without icon">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-basic-card text-a="1,284" text-b="Active users" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading state">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-basic-card loading text-a="placeholder" text-b="placeholder" />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BasicCardDemo
