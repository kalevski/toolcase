import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ColoredCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ColoredCard"
                            description="Dashboard card with a caller-supplied color tinting the icon chip and a metric display."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Revenue (green accent)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card icon="TrendingUp" value="$48,200" text="Total revenue" color="#22c55e" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Active users (blue accent)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card icon="Users" value="3,821" text="Active users this week" color="#3b82f6" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Alerts (orange accent)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card icon="AlertTriangle" value="14" text="Open alerts" color="#f97316" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading state">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card loading icon="BarChart2" value="—" text="placeholder" color="#6366f1" />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ColoredCardDemo
