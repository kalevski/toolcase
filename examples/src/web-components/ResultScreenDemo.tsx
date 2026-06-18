import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const STATS = [
    { label: 'Time', value: '14:32' },
    { label: 'Score', value: 18450 },
    { label: 'Accuracy', value: '87%' },
    { label: 'Best Combo', value: 'x12' },
]

const REWARDS = [
    { glyph: '◈', label: 'Gold', amount: 1200, color: 'var(--tc-warning)' },
    { glyph: '✦', label: 'Sigil', amount: 3 },
    { glyph: '❖', label: 'Lore', amount: 1 },
]

const ACTIONS = [
    { id: 'continue', label: 'Continue', variant: 'primary' as const },
    { id: 'replay', label: 'Replay', variant: 'default' as const },
    { id: 'menu', label: 'Main Menu', variant: 'ghost' as const },
]

const VICTORY_ACTIONS = [
    { id: 'next', label: 'Next Stage', variant: 'primary' as const },
    { id: 'menu', label: 'Main Menu', variant: 'ghost' as const },
]

const ResultScreenDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const victoryRef = useRef<any>(null)
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
        const el = victoryRef.current
        if (!el) return
        el.stats = STATS
        el.rewards = REWARDS
        el.actions = VICTORY_ACTIONS
    }, [])

    useEffect(() => {
        const el = minimalRef.current
        if (!el) return
        el.actions = [{ id: 'continue', label: 'Continue', variant: 'primary' }]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ResultScreen"
                            description="Match / round result screen: a centred region with a mono eyebrow, a status-toned title, a hairline divider, an optional subtitle, hairline-separated stat rows, a soft reward strip, and a row of action buttons. Stats, rewards, and actions are supplied via JS properties; title text/colour, subtitle, and eyebrow are attributes. Emits tc-action with the clicked action's id."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full screen (stats + rewards + actions)">
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    ref={fullRef}
                                    title-text="Round Complete"
                                    subtitle="A clean run through the cinder gates."
                                />
                                <div className="form-text mt-3">
                                    Last action: <code>{lastAction}</code>
                                </div>
                            </SectionCard>

                            <SectionCard title="Title colour: gold (victory tone)">
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    ref={victoryRef}
                                    title-text="Victory"
                                    eyebrow="Cleared"
                                    title-color="gold"
                                    subtitle="Every wave repelled. The stage is yours."
                                />
                            </SectionCard>

                            <SectionCard title="Title colour: danger (defeat tone)">
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    title-text="Defeat"
                                    eyebrow="Game Over"
                                    title-color="danger"
                                    subtitle="You were overrun at the final gate."
                                />
                            </SectionCard>

                            <SectionCard title="Minimal (defaults + a single action)">
                                {/* @ts-ignore */}
                                <tc-result-screen ref={minimalRef} title-text="Round Complete" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResultScreenDemo
