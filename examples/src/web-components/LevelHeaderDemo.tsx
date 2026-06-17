import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LevelHeaderDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="LevelHeader"
                            description="Level / stage title header banner — a compact ink badge showing the current level, an optional title, an XP progress bar, and an optional next-unlock label."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default (level, xp, xp-max)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-level-header level="1" xp="30" xp-max="100" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With title">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-level-header level="12" title="Scout" xp="4200" xp-max="8000" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With next-unlock label">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-level-header level="42" title="Aldric of the Vale" xp="6480" xp-max="9000" next-label="Mystic Blade" />
                                </div>
                            </SectionCard>

                            <SectionCard title="High level, near-full XP bar">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-level-header level="99" title="Champion" xp="98750" xp-max="100000" next-label="Prestige Mode" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Empty XP bar (0 / max)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-level-header level="7" title="Apprentice" xp="0" xp-max="2000" />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LevelHeaderDemo
