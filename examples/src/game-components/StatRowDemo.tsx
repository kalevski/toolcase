import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const StatRowDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="StatRow"
                    description="Single label/value row with optional accent color and trend (up/down) glyph + delta."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        <div style={{ maxWidth: 360, padding: 12, background: 'rgba(0,0,0,0.4)' }}>
                            {/* @ts-ignore */}
                            <gc-stat-row label="Strength" value="48" trend="3" />
                            {/* @ts-ignore */}
                            <gc-stat-row label="Agility" value="32" trend="-2" />
                            {/* @ts-ignore */}
                            <gc-stat-row label="Mana" value="120" accent="#5a8cf0" />
                            {/* @ts-ignore */}
                            <gc-stat-row label="Crit Rate" value="14%" accent="#d44a3a" trend="1" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default StatRowDemo
