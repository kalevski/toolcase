import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const CHARACTERS = [
    {
        id: 'astrid',
        name: 'Astrid',
        role: 'Bladewarden',
        portrait: 'A',
        description: 'Trained in the temple of Eldhar. Strong against single targets, weak against ranged sorcery.',
        stats: [
            { label: 'STR', value: 14 },
            { label: 'DEX', value: 11 },
            { label: 'INT', value: 7 },
            { label: 'WIS', value: 9 },
        ],
    },
    {
        id: 'vael',
        name: 'Vael',
        role: 'Pyromancer',
        portrait: 'V',
        description: 'Channels the second flame. Glass cannon — devastating spells, low HP.',
        stats: [
            { label: 'STR', value: 6 },
            { label: 'DEX', value: 9 },
            { label: 'INT', value: 16 },
            { label: 'WIS', value: 12 },
        ],
    },
    {
        id: 'hrolf',
        name: 'Hrolf',
        role: 'Stormbreaker',
        portrait: 'H',
        description: 'Blessed by the wind-lords. Tanky bruiser with knockback control.',
        stats: [
            { label: 'STR', value: 13 },
            { label: 'DEX', value: 8 },
            { label: 'INT', value: 8 },
            { label: 'WIS', value: 12 },
        ],
    },
    {
        id: 'mythic',
        name: '???',
        role: 'Locked',
        portrait: '?',
        locked: true,
        description: 'Complete the Cinder Trials to unlock.',
    },
]

const CharacterSelectDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [selected, setSelected] = useState('astrid')
    const [confirmed, setConfirmed] = useState('')

    useEffect(() => {
        const el: any = ref.current
        if (el) el.characters = CHARACTERS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (event: any) => setSelected(event.detail.id)
        const onConfirm = (event: any) => setConfirmed(event.detail.id)
        el.addEventListener('select', onSelect)
        el.addEventListener('confirm', onConfirm)
        return () => {
            el.removeEventListener('select', onSelect)
            el.removeEventListener('confirm', onConfirm)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Character Select"
                        description="Roster grid with portrait + role tile, side-detail panel, lock state, click to select / dblclick to confirm."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Selected: ${selected} — confirmed: ${confirmed || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-character-select ref={ref} selected-id={selected} />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterSelectDemo
