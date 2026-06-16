import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CHARACTERS = [
    {
        id: 'aria',
        name: 'Aria Voss',
        role: 'Vanguard',
        description: 'Front-line specialist who soaks damage and shields allies behind a kinetic barrier.',
        stats: [
            { label: 'Health', value: 1280 },
            { label: 'Armour', value: 'Heavy' },
            { label: 'Speed', value: 6 },
        ],
    },
    {
        id: 'kade',
        name: 'Kade Rin',
        role: 'Marksman',
        description: 'Long-range damage dealer with a charged rail shot and rapid repositioning.',
        stats: [
            { label: 'Health', value: 840 },
            { label: 'Armour', value: 'Light' },
            { label: 'Speed', value: 9 },
        ],
    },
    {
        id: 'sol',
        name: 'Sol',
        role: 'Support',
        description: 'Keeps the squad alive with area heals and a revive beacon.',
        stats: [
            { label: 'Health', value: 960 },
            { label: 'Armour', value: 'Medium' },
            { label: 'Speed', value: 7 },
        ],
    },
    {
        id: 'nyx',
        name: 'Nyx',
        role: 'Infiltrator',
        locked: true,
        description: 'Cloaks and flanks — unlocked at account level 20.',
        stats: [
            { label: 'Health', value: 720 },
            { label: 'Armour', value: 'Light' },
            { label: 'Speed', value: 10 },
        ],
    },
]

const CharacterSelectDemo: React.FC = () => {
    const basicRef = useRef<any>(null)

    const [selected, setSelected] = useState<string>('aria')
    const [confirmed, setConfirmed] = useState<string>('(none — double-click or use Enter then a confirm flow)')

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.characters = CHARACTERS

        const onSelect = (e: Event) => setSelected((e as CustomEvent<{ id: string }>).detail.id)
        const onConfirm = (e: Event) => setConfirmed((e as CustomEvent<{ id: string }>).detail.id)
        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-confirm', onConfirm)
        return () => {
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-confirm', onConfirm)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CharacterSelect"
                            description="Roster / character-selection screen: a grid of selectable tiles paired with a detail panel showing the active character's role, description, and stats. Characters are supplied via the `characters` JS property; the selection is reflected on the `selected-id` attribute. Emits tc-select (click / Enter) and tc-confirm (double-click). Locked tiles are inert."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Roster (data-driven tiles + detail panel)">
                                {/* @ts-ignore */}
                                <tc-character-select ref={basicRef} selected-id="aria" />
                                <div className="form-text mt-3">
                                    Selected: <code>{selected}</code>
                                </div>
                                <div className="form-text">
                                    Last confirmed: <code>{confirmed}</code>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterSelectDemo
