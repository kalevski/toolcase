import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SafeAreaDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Safe Area"
                    description="Padding inset for HUD edges. Wraps env(safe-area-inset-*) with optional extra padding."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default (only env insets)">
                        {/* @ts-ignore */}
                        <gc-safe-area style={{ outline: '1px dashed var(--fg-gold-deep)', minHeight: 80 }}>
                            <div style={{ background: 'rgba(201,169,97,0.15)', padding: 12, color: 'var(--fg-parch)' }}>HUD content</div>
                            {/* @ts-ignore */}
                        </gc-safe-area>
                    </SectionCard>

                    <SectionCard title="Extra 16px">
                        {/* @ts-ignore */}
                        <gc-safe-area extra="16px" style={{ outline: '1px dashed var(--fg-gold-deep)', minHeight: 80 }}>
                            <div style={{ background: 'rgba(201,169,97,0.15)', padding: 12, color: 'var(--fg-parch)' }}>HUD content with extra padding</div>
                            {/* @ts-ignore */}
                        </gc-safe-area>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default SafeAreaDemo
