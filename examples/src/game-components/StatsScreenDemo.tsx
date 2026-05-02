import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const SECTIONS = [
    {
        title: 'Combat',
        stats: [
            { label: 'Kills', value: 1284 },
            { label: 'Deaths', value: 142 },
            { label: 'K/D', value: 9.04 },
            { label: 'Headshots', value: 318 },
        ],
    },
    {
        title: 'Exploration',
        stats: [
            { label: 'Areas Found', value: 47 },
            { label: 'Lore Pages', value: 22 },
            { label: 'Distance', value: '1,420 km' },
            { label: 'Bosses', value: 8 },
        ],
    },
    {
        title: 'Economy',
        stats: [
            { label: 'Gold Earned', value: 184230 },
            { label: 'Items Crafted', value: 56 },
            { label: 'Trades', value: 19 },
            { label: 'Prestige', value: 'III' },
        ],
    },
]

const StatsScreenDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el: any = ref.current
        if (el) el.sections = SECTIONS
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Stats Screen"
                        description="Career statistics summary with grouped stat sections."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default" />
                            {/* @ts-ignore */}
                            <gc-stats-screen ref={ref} screen-title="Career Statistics" summary="Tallied across the seven realms since first ember." />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StatsScreenDemo
