import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const AmmoCounterDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="AmmoCounter"
                        description="Magazine / clip counter HUD readout — current rounds, magazine capacity, reserve ammo, an optional weapon name, and a reloading state."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Magazine and reserve">
                            {/* @ts-ignore */}
                            <tc-ammo-counter mag="24" mag-max="30" reserve="120" />
                        </SectionCard>

                        <SectionCard title="With weapon name">
                            {/* @ts-ignore */}
                            <tc-ammo-counter weapon-name="MK-18" mag="18" mag-max="30" reserve="90" />
                        </SectionCard>

                        <SectionCard title="Low magazine">
                            {/* @ts-ignore */}
                            <tc-ammo-counter weapon-name="Sidearm" mag="3" mag-max="17" reserve="34" />
                        </SectionCard>

                        <SectionCard title="Reloading">
                            {/* @ts-ignore */}
                            <tc-ammo-counter weapon-name="MK-18" mag="0" mag-max="30" reserve="90" reloading />
                        </SectionCard>

                        <SectionCard title="Row of readouts">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-ammo-counter weapon-name="Rifle" mag="30" mag-max="30" reserve="120" />
                                {/* @ts-ignore */}
                                <tc-ammo-counter weapon-name="Shotgun" mag="2" mag-max="8" reserve="24" />
                                {/* @ts-ignore */}
                                <tc-ammo-counter weapon-name="Launcher" mag="1" mag-max="1" reserve="4" />
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AmmoCounterDemo
