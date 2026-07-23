import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const PERKS_BASIC = [
    {
        id: 'iron-will',
        name: 'Iron Will',
        description: 'Reduces incoming damage by 15%.',
        icon: 'shield',
        selected: true,
    },
    {
        id: 'quickstep',
        name: 'Quickstep',
        description: 'Roll cooldown reduced by 20%.',
        icon: 'zap',
    },
    { id: 'bloodlust', name: 'Bloodlust', description: 'Crits restore 5 HP.', icon: 'heart-pulse' },
    { id: 'arcane', name: 'Arcane Surge', description: 'Mana regen +30%.', icon: 'sparkles' },
    { id: 'endure', name: 'Endure', description: 'Stamina drain reduced.', icon: 'timer' },
    {
        id: 'mastery',
        name: 'Mastery',
        description: 'Locked until level 30.',
        icon: 'star',
        locked: true,
    },
]

const PERKS_EVENTS = [
    { id: 'swift', name: 'Swift', description: '+10% move speed.', icon: 'wind' },
    { id: 'fortify', name: 'Fortify', description: '+15% max HP.', icon: 'shield' },
    { id: 'focus', name: 'Focus', description: 'Reduces skill cooldown.', icon: 'crosshair' },
    { id: 'rally', name: 'Rally', description: 'Revive allies faster.', icon: 'users' },
]

const PerkPickerDemo: React.FC = () => {
    const [selectedId, setSelectedId] = useState<string>('swift')
    const [log, setLog] = useState<string[]>([])

    const basicRef = useTc<HTMLElement>({ perks: PERKS_BASIC })
    const twoColRef = useTc<HTMLElement>({ perks: PERKS_BASIC.slice(0, 4) })
    const eventsRef = useTc<HTMLElement>(
        { perks: PERKS_EVENTS.map((p) => ({ ...p, selected: p.id === selectedId })) },
        {
            'tc-select': (e: any) => {
                setSelectedId(e.detail.id)
                setLog((l) => [`tc-select — id: "${e.detail.id}"`, ...l].slice(0, 8))
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PerkPicker"
                            description="Grid of selectable perk cards with selected and locked states. Perks are supplied via the JS perks property. Fires tc-select on click or Enter/Space. The columns attribute sets the grid column count."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="3 columns (default) — one pre-selected, one locked">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-perk-picker ref={basicRef} columns="3" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="2 columns">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-perk-picker ref={twoColRef} columns="2" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Events — tc-select">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-perk-picker ref={eventsRef} columns="2" />
                                </div>
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click a perk card…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PerkPickerDemo
