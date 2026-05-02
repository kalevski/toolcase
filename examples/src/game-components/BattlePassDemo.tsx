import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const TIERS = Array.from({ length: 12 }, (_, i) => {
    const lvl = i + 1
    return {
        level: lvl,
        xpRequired: 1000,
        free: { label: `XP×${lvl}`, icon: '✦', claimed: lvl < 4 },
        premium: { label: lvl % 3 === 0 ? 'Skin' : 'Gold', icon: lvl % 3 === 0 ? '◆' : '☩', claimed: lvl < 3 }
    }
})

const BattlePassDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.tiers = TIERS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: any) => setLast(`claim L${e.detail.level} ${e.detail.track}`)
        el.addEventListener('claim', handler)
        return () => el.removeEventListener('claim', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="BattlePass"
                        description="Free/premium reward track with XP progress, season header, and per-tier claim cells."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            <div style={{ maxWidth: 760 }}>
                                {/* @ts-ignore */}
                                <gc-battle-pass ref={ref} season-name="Season of Embers" season-end="2 weeks" current-level="5" current-xp="640" has-premium />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BattlePassDemo
