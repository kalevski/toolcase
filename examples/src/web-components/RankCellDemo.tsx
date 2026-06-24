import React from 'react'

const RankCellDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="RankCell"
                        description="Zero-padded rank number with tier accent for top-three positions. Gold for rank 1, silver for 2, bronze for 3, neutral for the rest. Designed for table and list cells — sharp corners, JetBrains Mono, tabular-nums alignment."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Top-three tiers (rank 1–3)">
                            <div className="d-flex gap-3 align-items-center flex-wrap">
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="1" pad="2"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="2" pad="2"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="3" pad="2"></tc-rank-cell>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Default tier (rank 4+)">
                            <div className="d-flex gap-3 align-items-center flex-wrap">
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="4" pad="2"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="17" pad="2"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="42" pad="2"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="100" pad="3"></tc-rank-cell>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom pad width">
                            <div className="d-flex gap-3 align-items-center flex-wrap">
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="1" pad="3"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="7" pad="3"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="12" pad="3"></tc-rank-cell>
                                {/* @ts-ignore */}
                                <tc-rank-cell rank="100" pad="3"></tc-rank-cell>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Inline within a leaderboard table">
                            <table className="table table-sm mb-0" style={{ fontSize: '0.875rem' }}>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-rank-cell rank="1" pad="2"></tc-rank-cell>
                                        </td>
                                        <td>Alice</td>
                                        <td>9,420</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-rank-cell rank="2" pad="2"></tc-rank-cell>
                                        </td>
                                        <td>Bob</td>
                                        <td>8,870</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-rank-cell rank="3" pad="2"></tc-rank-cell>
                                        </td>
                                        <td>Carol</td>
                                        <td>8,450</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-rank-cell rank="4" pad="2"></tc-rank-cell>
                                        </td>
                                        <td>Dave</td>
                                        <td>7,310</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            {/* @ts-ignore */}
                                            <tc-rank-cell rank="17" pad="2"></tc-rank-cell>
                                        </td>
                                        <td>Eve</td>
                                        <td>3,120</td>
                                    </tr>
                                </tbody>
                            </table>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RankCellDemo
