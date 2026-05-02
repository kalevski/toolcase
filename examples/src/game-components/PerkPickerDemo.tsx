import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const PERKS = [
    { id: 'p1', name: 'Iron Will', description: 'Reduces incoming damage by 15%.', icon: '🛡', selected: true },
    { id: 'p2', name: 'Quickstep', description: 'Roll cooldown reduced by 20%.', icon: '✦' },
    { id: 'p3', name: 'Bloodlust', description: 'Crits restore 5 HP.', icon: '⚔' },
    { id: 'p4', name: 'Arcane', description: 'Mana regen +30%.', icon: '❖' },
    { id: 'p5', name: 'Endure', description: 'Stamina drain reduced.', icon: '☩' },
    { id: 'p6', name: 'Mastery', description: 'Locked until level 30.', icon: '✦', locked: true }
]

const PerkPickerDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.perks = PERKS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: any) => setLast(`select ${e.detail.id}`)
        el.addEventListener('select', handler)
        return () => el.removeEventListener('select', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="PerkPicker"
                        description="Grid of selectable perk cards with selected/locked states and column count prop."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 720 }}>
                                {/* @ts-ignore */}
                                <gc-perk-picker ref={ref} columns="3" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PerkPickerDemo
