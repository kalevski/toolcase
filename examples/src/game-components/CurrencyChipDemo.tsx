import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const CurrencyChipDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="CurrencyChip"
                    description="Inline glyph + numeric amount in mono. Props: glyph, amount, color."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default (gold)">
                        {/* @ts-ignore */}
                        <gc-currency-chip glyph="◈" amount="1234" />
                    </SectionCard>

                    <SectionCard title="Currencies">
                        <div className="d-flex gap-3 align-items-center">
                            {/* @ts-ignore */}
                            <gc-currency-chip glyph="◈" amount="42500" />
                            {/* @ts-ignore */}
                            <gc-currency-chip glyph="✦" amount="78" color="var(--fg-arcane-bright)" />
                            {/* @ts-ignore */}
                            <gc-currency-chip glyph="❖" amount="9" color="var(--fg-mythic)" />
                            {/* @ts-ignore */}
                            <gc-currency-chip glyph="⛁" amount="1024000" color="var(--fg-silver)" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default CurrencyChipDemo
