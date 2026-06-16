import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const STATS = [
    { label: 'Score', value: 18420 },
    { label: 'Waves cleared', value: 12 },
    { label: 'Time survived', value: '07:41' },
]

const REWARDS = [
    { glyph: '◈', label: 'Gold', amount: 320, color: 'var(--tc-warning)' },
    { glyph: '★', label: 'XP', amount: 1500 },
]

const ACTIONS = [
    { id: 'retry', label: 'Try Again', variant: 'primary' as const },
    { id: 'menu', label: 'Main Menu', variant: 'default' as const },
    { id: 'quit', label: 'Quit', variant: 'ghost' as const },
]

const GameOverScreenDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)

    const [lastAction, setLastAction] = useState<string>('(none yet — click an action)')

    useEffect(() => {
        const el = fullRef.current
        if (!el) return
        el.stats = STATS
        el.rewards = REWARDS
        el.actions = ACTIONS

        const onAction = (e: Event) => setLastAction((e as CustomEvent<{ id: string }>).detail.id)
        el.addEventListener('tc-action', onAction)
        return () => el.removeEventListener('tc-action', onAction)
    }, [])

    useEffect(() => {
        const el = minimalRef.current
        if (!el) return
        el.actions = [{ id: 'restart', label: 'Restart', variant: 'primary' }]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="GameOverScreen"
                            description="Game-over end screen: a centred region with a mono eyebrow, a status-toned title, a hairline divider, an optional subtitle, hairline-separated stat rows, a soft reward strip, and a row of action buttons. Stats, rewards, and actions are supplied via JS properties; title text/colour, subtitle, and eyebrow are attributes. Emits tc-action with the clicked action's id."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full screen (stats + rewards + actions)">
                                {/* @ts-ignore */}
                                <tc-game-over-screen
                                    ref={fullRef}
                                    subtitle="You were overrun at wave 12. The colony has fallen."
                                />
                                <div className="form-text mt-3">
                                    Last action: <code>{lastAction}</code>
                                </div>
                            </SectionCard>

                            <SectionCard title="Title colour: gold (victory tone)">
                                {/* @ts-ignore */}
                                <tc-game-over-screen
                                    title-text="Victory"
                                    eyebrow="Cleared"
                                    title-color="gold"
                                    subtitle="Every wave repelled. The colony stands."
                                />
                            </SectionCard>

                            <SectionCard title="Minimal (defaults + a single action)">
                                {/* @ts-ignore */}
                                <tc-game-over-screen ref={minimalRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GameOverScreenDemo
