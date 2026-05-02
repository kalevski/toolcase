import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ScoreDisplayDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="ScoreDisplay"
                    description="Score readout with optional eyebrow label, multiplier badge (shown when ≠1), and alignment. Score formatted with toLocaleString."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Plain (no label, no multiplier)" />
                        <div className="d-flex gap-5">
                            {/* @ts-ignore */}
                            <gc-score-display score="1240" />
                            {/* @ts-ignore */}
                            <gc-score-display score="184550" />
                            {/* @ts-ignore */}
                            <gc-score-display score="9999999" font-size="44" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="With label" />
                        <div className="d-flex gap-5">
                            {/* @ts-ignore */}
                            <gc-score-display label="Score" score="42180" />
                            {/* @ts-ignore */}
                            <gc-score-display label="High Score" score="1284900" font-size="36" />
                            {/* @ts-ignore */}
                            <gc-score-display label="Round" score="500" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="With multiplier" />
                        <div className="d-flex gap-5">
                            {/* @ts-ignore */}
                            <gc-score-display label="Score" score="1240" multiplier="2" />
                            {/* @ts-ignore */}
                            <gc-score-display label="Score" score="84200" multiplier="3.5" font-size="36" />
                            {/* @ts-ignore */}
                            <gc-score-display label="Score" score="100" multiplier="1" />
                            <span style={{ alignSelf: 'center', fontFamily: 'var(--fg-mono)', color: 'var(--fg-parch-dim)' }}>
                                ← multiplier=1 hides the badge
                            </span>
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Alignment" />
                        <div className="d-flex flex-column gap-3" style={{ background: 'var(--fg-ink)', padding: 16 }}>
                            {/* @ts-ignore */}
                            <gc-score-display label="Left" score="12345" align="left" style={{ width: '100%' }} />
                            {/* @ts-ignore */}
                            <gc-score-display label="Center" score="12345" align="center" multiplier="2" style={{ width: '100%' }} />
                            {/* @ts-ignore */}
                            <gc-score-display label="Right" score="12345" align="right" style={{ width: '100%' }} />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default ScoreDisplayDemo
