import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const STATS = [
    { label: 'Wins', value: 184 },
    { label: 'Streak', value: 7 },
    { label: 'KD', value: 2.84 },
    { label: 'Hours', value: '423h' },
]

const ACTIONS = [
    { id: 'invite', label: 'Invite' },
    { id: 'whisper', label: 'Whisper' },
    { id: 'profile', label: 'Profile' },
    { id: 'block', label: 'Block', danger: true },
]

const PlayerCardDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('')

    useEffect(() => {
        const el: any = ref.current
        if (el) {
            el.stats = STATS
            el.actions = ACTIONS
        }
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setLast(event.detail.id)
        el.addEventListener('action', handler)
        return () => el.removeEventListener('action', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Player Card"
                        description="Friend / roster card with rank, level, stat grid, presence, and action row."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Online — last action: ${last || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-player-card ref={ref} player-name="Veyra Stormwake" card-title="Sworn of the Cinder Court" rank="Grandmaster" level={142} online-status="in-game" />
                        </SectionCard>
                        <SectionCard title="Offline">
                            {/* @ts-ignore */}
                            <gc-player-card player-name="Lir of Ashvale" card-title="Wandering Skald" rank="Veteran" level={88} online-status="offline" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlayerCardDemo
