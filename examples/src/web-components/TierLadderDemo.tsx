import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const TIERS_FULL = [
    { id: 'diamond', name: 'Diamond', range: '2000–∞', color: 'cyan' },
    { id: 'platinum', name: 'Platinum', range: '1500–1999', color: 'gray' },
    { id: 'gold', name: 'Gold', range: '1000–1499', color: 'yellow' },
    { id: 'silver', name: 'Silver', range: '500–999', color: 'gray' },
    { id: 'bronze', name: 'Bronze', range: '0–499', color: 'red' },
]

const TIERS_DANGER = [
    { id: 's', name: 'S Rank', range: '95–100', color: 'pink' },
    { id: 'a', name: 'A Rank', range: '80–94', color: 'yellow' },
    { id: 'b', name: 'B Rank', range: '65–79', color: 'cyan' },
    { id: 'c', name: 'C Rank', range: '50–64', color: 'gray' },
    { id: 'd', name: 'D Rank', range: '0–49', color: 'gray' },
]

const TierLadderDemo: React.FC = () => {
    const fullRef = useTc<HTMLElement>({ tiers: TIERS_FULL })
    const rankRef = useTc<HTMLElement>({ tiers: TIERS_DANGER })
    const emptyRef = useTc<HTMLElement>({ tiers: [] })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="TierLadder"
                            description="Ranked tier ladder with color-coded dots and a current-tier indicator. Supply tiers via the JS property; current tier is highlighted via the current-tier-id attribute."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="League ladder — current tier highlighted (with title and summary)">
                                {/* @ts-ignore */}
                                <tc-tier-ladder
                                    ref={fullRef}
                                    title="League Standings"
                                    current-tier-id="gold"
                                    summary="Points reset at the start of each season."
                                    style={{ maxWidth: 360 }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Rank ladder — no title, no summary, different current tier">
                                {/* @ts-ignore */}
                                <tc-tier-ladder
                                    ref={rankRef}
                                    current-tier-id="b"
                                    style={{ maxWidth: 360 }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Empty state — no tiers supplied">
                                {/* @ts-ignore */}
                                <tc-tier-ladder
                                    ref={emptyRef}
                                    title="Empty Ladder"
                                    style={{ maxWidth: 360 }}
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TierLadderDemo
