import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SectionFlagDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="SectionFlag"
                        description="Section heading with an accent marker bar, a title, and an optional subtitle. Supports left and center alignment."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Left aligned (default)">
                            {/* @ts-ignore */}
                            <tc-section-flag title="The Hall — ranked" subtitle="Top of the rolling 90-day board."></tc-section-flag>
                        </SectionCard>

                        <SectionCard title="Left aligned — title only">
                            {/* @ts-ignore */}
                            <tc-section-flag title="Points · continuous · never paused"></tc-section-flag>
                        </SectionCard>

                        <SectionCard title="Center aligned with subtitle">
                            {/* @ts-ignore */}
                            <tc-section-flag align="center" title="3 Briefs · rolled for Sprint 047" subtitle="Seeded RNG drew one easy + one medium + one hard from the master pool."></tc-section-flag>
                        </SectionCard>

                        <SectionCard title="Center aligned — title only">
                            {/* @ts-ignore */}
                            <tc-section-flag align="center" title="Season 4 — Leaderboard"></tc-section-flag>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SectionFlagDemo
