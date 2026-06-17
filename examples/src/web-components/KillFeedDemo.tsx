import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    { id: '1', killerName: 'Aldric', victimName: 'Goblin', killerColor: '#3b82f6', victimColor: '#ef4444', weapon: '⚔' },
    { id: '2', killerName: 'Brina', victimName: 'Wraith', killerColor: '#22c55e', victimColor: '#a855f7', weapon: '✦', headshot: true },
    { id: '3', killerName: 'Caelum', victimName: 'Bandit', killerColor: '#f59e0b', victimColor: '#ef4444', weapon: '🏹' },
]

const EXTENDED_ENTRIES: KillFeedEntry[] = [
    ...BASE_ENTRIES,
    { id: '4', killerName: 'Deva', victimName: 'Troll', killerColor: '#06b6d4', victimColor: '#ef4444', weapon: '⚔', headshot: true },
    { id: '5', killerName: 'Elan', victimName: 'Goblin', killerColor: '#3b82f6', victimColor: '#ef4444', weapon: '🏹' },
    { id: '6', killerName: 'Fyra', victimName: 'Wraith', killerColor: '#22c55e', victimColor: '#a855f7', weapon: '⚔' },
    { id: '7', killerName: 'Gorn', victimName: 'Bandit', killerColor: '#f59e0b', victimColor: '#ef4444', weapon: '✦', headshot: true },
]

const KillFeedDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const noColorRef = useRef<any>(null)
    const maxVisibleRef = useRef<any>(null)
    const headshotRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) basicRef.current.entries = BASE_ENTRIES
    }, [])

    useEffect(() => {
        if (noColorRef.current) {
            noColorRef.current.entries = BASE_ENTRIES.map(e => ({
                ...e,
                killerColor: undefined,
                victimColor: undefined,
            }))
        }
    }, [])

    useEffect(() => {
        if (maxVisibleRef.current) maxVisibleRef.current.entries = EXTENDED_ENTRIES
    }, [])

    useEffect(() => {
        if (headshotRef.current) {
            headshotRef.current.entries = BASE_ENTRIES.map(e => ({ ...e, headshot: true }))
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="KillFeed"
                            description="Stacking feed of kill/event entries with optional per-entry name colours, weapon label, and headshot indicator. Entries set via the JS entries property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic — per-entry name colours">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={basicRef} max-visible="5" />
                            </SectionCard>

                            <SectionCard title="Default slate colours (no killerColor / victimColor)">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={noColorRef} max-visible="5" />
                            </SectionCard>

                            <SectionCard title="max-visible=3 — oldest trimmed (7 entries supplied)">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={maxVisibleRef} max-visible="3" />
                            </SectionCard>

                            <SectionCard title="All entries with headshot indicator">
                                {/* @ts-ignore */}
                                <tc-kill-feed ref={headshotRef} max-visible="5" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KillFeedDemo
