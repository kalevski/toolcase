import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

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
    const [lastAction, setLastAction] = useState<string>('(none yet — click an action)')

    const fullRef = useTc<HTMLElement>(
        { stats: STATS, rewards: REWARDS, actions: ACTIONS },
        {
            'tc-action': (e: Event) =>
                setLastAction((e as CustomEvent<{ id: string }>).detail.id),
        }
    )
    const victoryRef = useTc<HTMLElement>({
        stats: STATS,
        rewards: REWARDS,
        actions: VICTORY_ACTIONS,
    })
    const minimalRef = useTc<HTMLElement>({
        actions: [{ id: 'continue', label: 'Continue', variant: 'primary' }],
    })
    const defeatRef = useTc<HTMLElement>({ actions: ACTIONS })
    const winRef = useTc<HTMLElement>({ stats: STATS, actions: VICTORY_ACTIONS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ResultScreen"
                            description="Match / round result screen: a centred region with a mono eyebrow, a status-toned title, a hairline divider, an optional subtitle, hairline-separated stat rows, a soft reward strip, and a row of action buttons. Stats, rewards, and actions are supplied via JS properties; title text/colour, subtitle, and eyebrow are attributes. Emits tc-action with the clicked action's id."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full screen (stats + rewards + actions)">
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    ref={fullRef}
                                    title-text="Round Complete"
                                    subtitle="A clean run through the cinder gates."
                                />
                                <div className="form-text mt-3">
                                    Last action: <code>{lastAction}</code>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Title colour: gold (victory tone)">
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    ref={victoryRef}
                                    title-text="Victory"
                                    eyebrow="Cleared"
                                    title-color="gold"
                                    subtitle="Every wave repelled. The stage is yours."
                                />
                            </tc-section-card>

                            <tc-section-card title="Title colour: danger (defeat tone)">
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    title-text="Defeat"
                                    eyebrow="Game Over"
                                    title-color="danger"
                                    subtitle="You were overrun at the final gate."
                                />
                            </tc-section-card>

                            <tc-section-card title="Minimal (defaults + a single action)">
                                {/* @ts-ignore */}
                                <tc-result-screen ref={minimalRef} title-text="Round Complete" />
                            </tc-section-card>

                            <tc-section-card title='Variant="defeat" (seeds "Game Over" / danger)'>
                                {/* @ts-ignore */}
                                <tc-result-screen
                                    ref={defeatRef}
                                    variant="defeat"
                                    subtitle="The colony has fallen."
                                />
                            </tc-section-card>

                            <tc-section-card title="Preset alias tag: tc-victory-screen">
                                {/* @ts-ignore */}
                                <tc-victory-screen
                                    ref={winRef}
                                    subtitle="All waves repelled. The colony stands."
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResultScreenDemo
