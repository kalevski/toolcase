import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ScoreDisplayDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="ScoreDisplay"
                        description="Score readout HUD — a prominent JetBrains Mono value with an optional micro-label and an optional multiplier chip."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Basic score">
                            {/* @ts-ignore */}
                            <tc-score-display score="12450" />
                        </SectionCard>

                        <SectionCard title="With label">
                            {/* @ts-ignore */}
                            <tc-score-display label="Score" score="9875" />
                        </SectionCard>

                        <SectionCard title="With multiplier">
                            {/* @ts-ignore */}
                            <tc-score-display label="Score" score="4200" multiplier="2" />
                        </SectionCard>

                        <SectionCard title="Multiplier = 1 (hidden)">
                            {/* @ts-ignore */}
                            <tc-score-display label="Score" score="4200" multiplier="1" />
                        </SectionCard>

                        <SectionCard title="Alignment">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-score-display label="Left" score="1000" align="left" style={{ minWidth: '8rem' }} />
                                {/* @ts-ignore */}
                                <tc-score-display label="Center" score="2000" align="center" style={{ minWidth: '8rem' }} />
                                {/* @ts-ignore */}
                                <tc-score-display label="Right" score="3000" align="right" style={{ minWidth: '8rem' }} />
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom font size">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-score-display label="Small" score="500" font-size="18" />
                                {/* @ts-ignore */}
                                <tc-score-display label="Default" score="1500" />
                                {/* @ts-ignore */}
                                <tc-score-display label="Large" score="99999" font-size="40" />
                            </div>
                        </SectionCard>

                        <SectionCard title="HUD row">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-score-display label="Total" score="125400" multiplier="3" />
                                {/* @ts-ignore */}
                                <tc-score-display label="Kills" score="18" />
                                {/* @ts-ignore */}
                                <tc-score-display label="Assists" score="7" />
                                {/* @ts-ignore */}
                                <tc-score-display label="Bonus" score="2000" multiplier="1.5" />
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ScoreDisplayDemo
