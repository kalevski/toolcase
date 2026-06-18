import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const StatRowDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="StatRow"
                        description="Label + value stat row with an optional trend indicator. Port of gc-stat-row; styled to the slate design system."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Basic rows">
                            <div style={{ border: '1px solid var(--tc-border)', borderRadius: 0 }}>
                                {/* @ts-ignore */}
                                <tc-stat-row label="Score" value="12450" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Kills" value="18" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Deaths" value="3" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Assists" value="7" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With trend indicators">
                            <div style={{ border: '1px solid var(--tc-border)', borderRadius: 0 }}>
                                {/* @ts-ignore */}
                                <tc-stat-row label="Win Rate" value="64.2%" trend="5.3" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="KDA Ratio" value="3.8" trend="-0.4" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Avg Damage" value="18340" trend="2100" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Headshots" value="52%" trend="-3.1" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Trend = 0 (hidden)">
                            <div style={{ border: '1px solid var(--tc-border)', borderRadius: 0 }}>
                                {/* @ts-ignore */}
                                <tc-stat-row label="Playtime" value="120h" trend="0" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Rank" value="Gold I" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With accent color">
                            <div style={{ border: '1px solid var(--tc-border)', borderRadius: 0 }}>
                                {/* @ts-ignore */}
                                <tc-stat-row label="HP" value="340 / 400" accent="var(--tc-success)" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="MP" value="120 / 200" accent="var(--tc-info)" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Stamina" value="60 / 100" accent="var(--tc-warning)" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Shield" value="0 / 50" accent="var(--tc-danger)" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Numeric formatting">
                            <div style={{ border: '1px solid var(--tc-border)', borderRadius: 0 }}>
                                {/* @ts-ignore */}
                                <tc-stat-row label="Gold Earned" value="1234567" trend="50000" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="XP" value="98765" trend="-1200" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Distance" value="42195" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Mixed — accent + trend">
                            <div style={{ border: '1px solid var(--tc-border)', borderRadius: 0 }}>
                                {/* @ts-ignore */}
                                <tc-stat-row label="Damage Dealt" value="84200" trend="12000" accent="var(--tc-danger)" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Healing Done" value="31500" trend="3400" accent="var(--tc-success)" />
                                {/* @ts-ignore */}
                                <tc-stat-row label="Crowd Control" value="14" trend="-2" accent="var(--tc-info)" />
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StatRowDemo
