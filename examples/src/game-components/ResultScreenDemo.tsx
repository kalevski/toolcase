import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const STATS = [
    { label: 'Time', value: '14:32' },
    { label: 'Score', value: 18450 },
    { label: 'Accuracy', value: '87%' },
    { label: 'Best Combo', value: 'x12' },
]

const REWARDS = [
    { label: 'Gold', glyph: '◈', amount: 1200 },
    { label: 'Sigil', glyph: '✦', amount: 3 },
    { label: 'Lore', glyph: '❖', amount: 1 },
]

const ACTIONS = [
    { id: 'continue', label: 'Continue', variant: 'primary' as const },
    { id: 'replay', label: 'Replay', variant: 'default' as const },
    { id: 'menu', label: 'Main Menu', variant: 'ghost' as const },
]

const RETRY_ACTIONS = [
    { id: 'retry', label: 'Retry', variant: 'primary' as const },
    { id: 'menu', label: 'Quit', variant: 'ghost' as const },
]

const ResultScreenDemo: React.FC = () => {
    const refResult = useRef<HTMLElement>(null)
    const refVictory = useRef<HTMLElement>(null)
    const refGameOver = useRef<HTMLElement>(null)
    const [last, setLast] = useState('')

    useEffect(() => {
        const a: any = refResult.current
        if (a) {
            a.stats = STATS
            a.rewards = REWARDS
            a.actions = ACTIONS
        }
        const b: any = refVictory.current
        if (b) {
            b.stats = STATS
            b.rewards = REWARDS
            b.actions = ACTIONS
        }
        const c: any = refGameOver.current
        if (c) {
            c.stats = STATS
            c.actions = RETRY_ACTIONS
        }
    }, [])

    useEffect(() => {
        const els = [refResult.current, refVictory.current, refGameOver.current]
        const handler = (event: any) => setLast(event.detail.id)
        els.forEach((el) => el?.addEventListener('action', handler))
        return () => els.forEach((el) => el?.removeEventListener('action', handler))
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Result Screen"
                        description="Round-end summary with stats, rewards, and action row. Game Over and Victory variants extend it."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Generic — last action: ${last || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-result-screen ref={refResult} title-text="Round Complete" subtitle="A clean run through the cinder gates." />
                        </SectionCard>
                        <SectionCard title="Victory variant">
                            {/* @ts-ignore */}
                            <gc-victory-screen ref={refVictory} subtitle="The flame-warden falls, and the gates yield." />
                        </SectionCard>
                        <SectionCard title="Game Over variant">
                            {/* @ts-ignore */}
                            <gc-game-over-screen ref={refGameOver} subtitle="Your name is added to the chapel's stone." />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResultScreenDemo
