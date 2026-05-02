import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ITEMS = [
    { item: { id: 'gold', name: 'Gold', icon: '◆' }, qty: 250 },
    { item: { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'uncommon' } },
    { item: { id: 'gem', name: 'Soul Gem', icon: '✦', rarity: 'epic' }, qty: 1 },
    { item: { id: 'cloak', name: 'Shadow Cloak', icon: '◆', rarity: 'rare' } }
]

const LootListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.items = ITEMS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onTake = (e: any) => setLast(`take ${e.detail.id}`)
        const onAll = () => setLast('take-all')
        el.addEventListener('take', onTake)
        el.addEventListener('take-all', onAll)
        return () => {
            el.removeEventListener('take', onTake)
            el.removeEventListener('take-all', onAll)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="LootList"
                        description="Drop list with rarity-coloured names, take-one, and take-all actions."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 420 }}>
                                {/* @ts-ignore */}
                                <gc-loot-list ref={ref} list-title="Loot" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LootListDemo
