import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const STATS = [
    { label: 'Score', value: 24800 },
    { label: 'Waves cleared', value: 20 },
    { label: 'Time survived', value: '12:33' },
    { label: 'Accuracy', value: '87%' },
]

const REWARDS = [
    { glyph: '◈', label: 'Gold', amount: 640, color: 'var(--tc-warning)' },
    { glyph: '★', label: 'XP', amount: 3000 },
    { glyph: '◆', label: 'Gems', amount: 5, color: 'var(--tc-info)' },
]

const ACTIONS = [
    { id: 'continue', label: 'Continue', variant: 'primary' as const },
    { id: 'retry', label: 'Play Again', variant: 'default' as const },
    { id: 'menu', label: 'Main Menu', variant: 'ghost' as const },
]

const VictoryScreenDemo: React.FC = () => {
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
        el.actions = [{ id: 'continue', label: 'Continue', variant: 'primary' }]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="VictoryScreen"
                            description="Victory end screen: a centred region with a mono eyebrow, a gold-toned title, a hairline divider, an optional subtitle, hairline-separated stat rows, a soft reward strip, and a row of action buttons. Stats, rewards, and actions are supplied via JS properties; title text/colour, subtitle, and eyebrow are attributes. Emits tc-action with the clicked action's id."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full screen (stats + rewards + actions)">
                                {/* @ts-ignore */}
                                <tc-victory-screen
                                    ref={fullRef}
                                    subtitle="All waves repelled. The colony stands victorious."
                                />
                                <div className="form-text mt-3">
                                    Last action: <code>{lastAction}</code>
                                </div>
                            </SectionCard>

                            <SectionCard title="Danger tone (defeat override)">
                                {/* @ts-ignore */}
                                <tc-victory-screen
                                    title-text="Pyrrhic Victory"
                                    eyebrow="Survived"
                                    title-color="danger"
                                    subtitle="The enemy is gone — but so is the colony."
                                />
                            </SectionCard>

                            <SectionCard title="Minimal (defaults + a single action)">
                                {/* @ts-ignore */}
                                <tc-victory-screen ref={minimalRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VictoryScreenDemo
