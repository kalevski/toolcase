import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const LevelHeaderDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="LevelHeader"
                    description="Account/character level badge with title, XP bar, and next-unlock label."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        <div style={{ maxWidth: 520, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--fg-gold-deep)' }}>
                            {/* @ts-ignore */}
                            <gc-level-header level="42" title="Aldric of the Vale" xp="6480" xp-max="9000" next-label="Mystic Blade" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default LevelHeaderDemo
