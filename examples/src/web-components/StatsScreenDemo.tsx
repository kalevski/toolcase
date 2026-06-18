import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import type { StatsSection } from '@toolcase/web-components'

const matchSections: StatsSection[] = [
    {
        title: 'Performance',
        stats: [
            { label: 'Kills', value: 24 },
            { label: 'Deaths', value: 7 },
            { label: 'Assists', value: 11 },
            { label: 'K/D Ratio', value: '3.43' },
        ],
    },
    {
        title: 'Objectives',
        stats: [
            { label: 'Flags Captured', value: 4 },
            { label: 'Objectives Completed', value: 8 },
            { label: 'Time on Objective', value: '4:32' },
        ],
    },
    {
        title: 'Accuracy',
        stats: [
            { label: 'Shots Fired', value: 1847 },
            { label: 'Shots Hit', value: 923 },
            { label: 'Accuracy', value: '49.97%' },
            { label: 'Headshots', value: 214 },
        ],
    },
]

const minimalSections: StatsSection[] = [
    {
        title: 'Round',
        stats: [
            { label: 'Score', value: 4200 },
            { label: 'Rank', value: '#2' },
        ],
    },
]

const StatsScreenDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const minRef = useRef<any>(null)

    useEffect(() => {
        if (fullRef.current) fullRef.current.sections = matchSections
        if (minRef.current) minRef.current.sections = minimalSections
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Stats Screen"
                            description="End-of-match statistics panel. Driven by the screen-title and summary attributes plus the sections JS property. Purely presentational — no events, no slots."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full match stats">
                                {/* @ts-ignore */}
                                <tc-stats-screen
                                    ref={fullRef}
                                    screen-title="Match Complete"
                                    summary="Victory — Capture the Flag · EU-West"
                                />
                            </SectionCard>

                            <SectionCard title="Minimal — single section, no summary">
                                {/* @ts-ignore */}
                                <tc-stats-screen ref={minRef} screen-title="Round Over" />
                            </SectionCard>

                            <SectionCard title="Attribute-only — no sections">
                                {/* @ts-ignore */}
                                <tc-stats-screen
                                    screen-title="Game Over"
                                    summary="No data available for this session."
                                />
                            </SectionCard>

                            <SectionCard title="Default title (screen-title omitted)">
                                {/* @ts-ignore */}
                                <tc-stats-screen />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StatsScreenDemo
