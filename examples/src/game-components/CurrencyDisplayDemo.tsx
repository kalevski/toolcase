import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const CurrencyDisplayDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="CurrencyDisplay"
                    description="HUD-scale currency readout with optional eyebrow label. Props: amount, currencyIcon, label, color, fontSize."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        {/* @ts-ignore */}
                        <gc-currency-display amount="42500" currency-icon="◈" />
                    </SectionCard>

                    <SectionCard title="With label">
                        {/* @ts-ignore */}
                        <gc-currency-display amount="1024000" currency-icon="◈" label="Gold" />
                    </SectionCard>

                    <SectionCard title="Custom color + larger font">
                        {/* @ts-ignore */}
                        <gc-currency-display
                            amount="78"
                            currency-icon="✦"
                            label="Arcane Shards"
                            color="var(--fg-arcane-bright)"
                            font-size="26"
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default CurrencyDisplayDemo
