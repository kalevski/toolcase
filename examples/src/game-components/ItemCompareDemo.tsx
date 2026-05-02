import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const CURRENT = {
    id: 'iron',
    name: 'Iron Long-sword',
    icon: '⚔',
    rarity: 'common',
    typeLabel: 'One-Handed Sword',
    stats: [
        { label: 'Damage', value: 84 },
        { label: 'Crit', value: 12 },
        { label: 'Speed', value: 14 }
    ]
}

const CANDIDATE = {
    id: 'flame',
    name: 'Flameheart Edge',
    icon: '🔥',
    rarity: 'epic',
    typeLabel: 'One-Handed Sword',
    flavor: 'Hot to the touch even in winter.',
    stats: [
        { label: 'Damage', value: 124 },
        { label: 'Crit', value: 9 },
        { label: 'Speed', value: 14 },
        { label: 'Fire', value: 22 }
    ]
}

const ItemCompareDemo: React.FC = () => {
    const refBoth = useRef<HTMLElement>(null)
    const refOne = useRef<HTMLElement>(null)

    useEffect(() => {
        const both = refBoth.current as any
        if (both) {
            both.current = CURRENT
            both.candidate = CANDIDATE
        }
        const one = refOne.current as any
        if (one) {
            one.current = CURRENT
            one.candidate = null
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Item Compare"
                        description="Two-tooltip comparison with delta column highlighting up/down stat differences."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Equipped vs Candidate" />
                            {/* @ts-ignore */}
                            <gc-item-compare ref={refBoth} />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="No candidate" />
                            {/* @ts-ignore */}
                            <gc-item-compare ref={refOne} />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemCompareDemo
