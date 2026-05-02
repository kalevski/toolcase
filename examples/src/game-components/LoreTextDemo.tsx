import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const LoreTextDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="LoreText"
                    description="Italic flavor body text. Slot-based — used in tooltips, loading screens, codex pages."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Short flavor">
                        {/* @ts-ignore */}
                        <gc-lore-text>
                            Some swords remember every hand that wielded them.
                        </gc-lore-text>
                    </SectionCard>

                    <SectionCard title="Paragraph">
                        {/* @ts-ignore */}
                        <gc-lore-text>
                            The library at Velkhar burned for three nights and still its ashes
                            whispered names. Scholars came from distant kingdoms to listen, hoping
                            to catch a verse, a date, a forgotten lineage — anything the fire had
                            chosen to spare.
                        </gc-lore-text>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default LoreTextDemo
