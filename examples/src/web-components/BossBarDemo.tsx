import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BossBarDemo: React.FC = () => {
    // phaseTicks is a JS-property array — React can't set it as an attribute, so
    // reach for the element via a ref and assign it after mount.
    const ticksRef = useRef<any>(null)
    useEffect(() => {
        if (ticksRef.current) ticksRef.current.phaseTicks = [0.25, 0.5, 0.75]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="BossBar"
                            description="Wide top-of-screen boss health bar — a boss name, an optional epithet, a phase indicator, an ink health fill over a flat slate track, and a mono hp / hp-max readout."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Boss with epithet">
                                {/* @ts-ignore */}
                                <tc-boss-bar
                                    name="Malphas"
                                    epithet="the Devourer"
                                    phase="1"
                                    hp="820"
                                    hp-max="1000"
                                />
                            </SectionCard>

                            <SectionCard title="Later phase, lower health">
                                {/* @ts-ignore */}
                                <tc-boss-bar name="Vault Sentinel" phase="3" hp="180" hp-max="1000" />
                            </SectionCard>

                            <SectionCard title="Phase ticks (phaseTicks property)">
                                {/* @ts-ignore */}
                                <tc-boss-bar
                                    ref={ticksRef}
                                    name="Hollow King"
                                    epithet="Throne of Ash"
                                    phase="2"
                                    hp="640"
                                    hp-max="1000"
                                />
                            </SectionCard>

                            <SectionCard title="Nearly defeated">
                                {/* @ts-ignore */}
                                <tc-boss-bar name="Rotbound Colossus" phase="4" hp="35" hp-max="1000" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BossBarDemo
