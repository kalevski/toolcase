import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const AmmoCounterDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="AmmoCounter"
                    description="Weapon ammo readout. Low (<20% magMax) turns blood-bright; reloading dims and shows label."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        {/* @ts-ignore */}
                        <gc-ammo-counter weapon-name="Riftwalker" mag="24" mag-max="30" reserve="120" />
                    </SectionCard>

                    <SectionCard title="Low ammo (<20%)">
                        {/* @ts-ignore */}
                        <gc-ammo-counter weapon-name="Lichbreaker" mag="4" mag-max="30" reserve="60" />
                    </SectionCard>

                    <SectionCard title="Reloading">
                        {/* @ts-ignore */}
                        <gc-ammo-counter weapon-name="Stormcaller" mag="0" mag-max="30" reserve="120" reloading />
                    </SectionCard>

                    <SectionCard title="No weapon name">
                        {/* @ts-ignore */}
                        <gc-ammo-counter mag="12" mag-max="40" reserve="80" />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default AmmoCounterDemo
