import React, { useEffect, useRef, useState } from 'react'

const tiers = Array.from({ length: 8 }, (_, i) => {
    const level = i + 1
    return {
        level,
        xpRequired: 1000,
        free: { label: `${level * 100} XP`, icon: 'star', claimed: level < 3 },
        premium: {
            label: level % 3 === 0 ? 'Skin' : 'Gold',
            icon: level % 3 === 0 ? 'shirt' : 'coins',
            claimed: level < 2,
        },
    }
})

const freeOnly = Array.from({ length: 5 }, (_, i) => {
    const level = i + 1
    return {
        level,
        xpRequired: 800,
        free: {
            label: level % 2 === 0 ? 'Crate' : `${level * 50} XP`,
            icon: level % 2 === 0 ? 'package' : 'star',
            claimed: level < 2,
        },
        // a couple of tiers have no free reward to show the empty-slot placeholder
        premium: level % 2 === 0 ? { label: 'Emote', icon: 'smile' } : undefined,
    }
})

const BattlePassDemo: React.FC = () => {
    const premiumRef = useRef<any>(null)
    const freeRef = useRef<any>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        if (premiumRef.current) premiumRef.current.tiers = tiers
        if (freeRef.current) freeRef.current.tiers = freeOnly
    }, [])

    useEffect(() => {
        const el = premiumRef.current
        if (!el) return
        const handler = (e: any) => setLast(`Claimed L${e.detail.level} · ${e.detail.track}`)
        el.addEventListener('tc-claim', handler)
        return () => el.removeEventListener('tc-claim', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BattlePass"
                            description="Battle-pass tier track with a season header, an XP progress bar, and a premium/free reward track of claimable cells. Set tiers via the tiers JS property; claimable cells fire tc-claim with { level, track }."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title={`Premium pass — last: ${last}`}>
                                <div style={{ maxWidth: 760 }}>
                                    {/* @ts-ignore */}
                                    <tc-battle-pass
                                        ref={premiumRef}
                                        season-name="Season of Embers"
                                        season-end="2 weeks"
                                        current-level="5"
                                        current-xp="640"
                                        has-premium
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Free pass (premium locked)">
                                <div style={{ maxWidth: 620 }}>
                                    {/* @ts-ignore */}
                                    <tc-battle-pass
                                        ref={freeRef}
                                        season-name="Founders Run"
                                        season-end="Apr 30"
                                        current-level="3"
                                        current-xp="520"
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BattlePassDemo
