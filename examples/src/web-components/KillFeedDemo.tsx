import React from 'react'
import { useTc } from '@toolcase/web-components/react'

interface KillFeedEntry {
    id: string
    killerName: string
    victimName: string
    killerColor?: string
    victimColor?: string
    weapon?: string
    headshot?: boolean
}

const BASE_ENTRIES: KillFeedEntry[] = [
    {
        id: '1',
        killerName: 'Aldric',
        victimName: 'Goblin',
        killerColor: '#3b82f6',
        victimColor: '#ef4444',
        weapon: '⚔',
    },
    {
        id: '2',
        killerName: 'Brina',
        victimName: 'Wraith',
        killerColor: '#22c55e',
        victimColor: '#a855f7',
        weapon: '✦',
        headshot: true,
    },
    {
        id: '3',
        killerName: 'Caelum',
        victimName: 'Bandit',
        killerColor: '#f59e0b',
        victimColor: '#ef4444',
        weapon: '🏹',
    },
]

const EXTENDED_ENTRIES: KillFeedEntry[] = [
    ...BASE_ENTRIES,
    {
        id: '4',
        killerName: 'Deva',
        victimName: 'Troll',
        killerColor: '#06b6d4',
        victimColor: '#ef4444',
        weapon: '⚔',
        headshot: true,
    },
    {
        id: '5',
        killerName: 'Elan',
        victimName: 'Goblin',
        killerColor: '#3b82f6',
        victimColor: '#ef4444',
        weapon: '🏹',
    },
    {
        id: '6',
        killerName: 'Fyra',
        victimName: 'Wraith',
        killerColor: '#22c55e',
        victimColor: '#a855f7',
        weapon: '⚔',
    },
    {
        id: '7',
        killerName: 'Gorn',
        victimName: 'Bandit',
        killerColor: '#f59e0b',
        victimColor: '#ef4444',
        weapon: '✦',
        headshot: true,
    },
]

const KillFeedDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({ entries: BASE_ENTRIES })
    const noColorRef = useTc<HTMLElement>({
        entries: BASE_ENTRIES.map((e) => ({
            ...e,
            killerColor: undefined,
            victimColor: undefined,
        })),
    })
    const maxVisibleRef = useTc<HTMLElement>({ entries: EXTENDED_ENTRIES })
    const headshotRef = useTc<HTMLElement>({
        entries: BASE_ENTRIES.map((e) => ({ ...e, headshot: true })),
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="KillFeed"
                            description="Stacking feed of kill/event entries with optional per-entry name colours, weapon label, and headshot indicator. Entries set via the JS entries property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — per-entry name colours">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={basicRef} max-visible="5" />
                            </tc-section-card>

                            <tc-section-card title="Default slate colours (no killerColor / victimColor)">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={noColorRef} max-visible="5" />
                            </tc-section-card>

                            <tc-section-card title="max-visible=3 — oldest trimmed (7 entries supplied)">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={maxVisibleRef} max-visible="3" />
                            </tc-section-card>

                            <tc-section-card title="All entries with headshot indicator">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={headshotRef} max-visible="5" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KillFeedDemo
