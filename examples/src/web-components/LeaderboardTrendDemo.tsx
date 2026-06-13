import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LeaderboardTrendDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="LeaderboardTrend"
                        description="Small directional trend indicator with an arrow icon and value. Three directions — up, down, flat — drive the icon and color. Purely presentational; designed to sit inline within table cells or metric rows."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Directions (value attribute)">
                            <div className="d-flex gap-3 align-items-center flex-wrap">
                                {/* @ts-ignore */}
                                <tc-leaderboard-trend value="+12%" direction="up"></tc-leaderboard-trend>
                                {/* @ts-ignore */}
                                <tc-leaderboard-trend value="-8%" direction="down"></tc-leaderboard-trend>
                                {/* @ts-ignore */}
                                <tc-leaderboard-trend value="0%" direction="flat"></tc-leaderboard-trend>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted value (no value attribute)">
                            <p className="mb-2" style={{ fontSize: '0.85rem', color: 'var(--tc-text-muted)' }}>
                                When <code>value</code> is omitted, child nodes are projected into the value span.
                            </p>
                            <div className="d-flex gap-3 align-items-center flex-wrap">
                                {/* @ts-ignore */}
                                <tc-leaderboard-trend direction="up"><strong>+5</strong> pts</tc-leaderboard-trend>
                                {/* @ts-ignore */}
                                <tc-leaderboard-trend direction="down"><em>-3</em> pts</tc-leaderboard-trend>
                                {/* @ts-ignore */}
                                <tc-leaderboard-trend direction="flat">no change</tc-leaderboard-trend>
                            </div>
                        </SectionCard>

                        <SectionCard title="Inline within a leaderboard row">
                            <table className="table table-sm mb-0" style={{ fontSize: '0.875rem' }}>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th>Score</th>
                                        <th>Trend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>1</td>
                                        <td>Alice</td>
                                        <td>9,420</td>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-leaderboard-trend value="+240" direction="up"></tc-leaderboard-trend>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>2</td>
                                        <td>Bob</td>
                                        <td>8,870</td>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-leaderboard-trend value="-130" direction="down"></tc-leaderboard-trend>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>3</td>
                                        <td>Carol</td>
                                        <td>8,450</td>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-leaderboard-trend value="0" direction="flat"></tc-leaderboard-trend>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default LeaderboardTrendDemo
