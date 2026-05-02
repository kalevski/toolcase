import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const FIELDS = [
    {
        id: 'race',
        label: 'Race',
        type: 'select' as const,
        options: [
            { value: 'human', label: 'Human' },
            { value: 'elf', label: 'Sun Elf' },
            { value: 'orc', label: 'Mountain Orc' },
            { value: 'dwarf', label: 'Granite Dwarf' },
        ],
    },
    {
        id: 'class',
        label: 'Class',
        type: 'select' as const,
        options: [
            { value: 'warden', label: 'Bladewarden' },
            { value: 'pyro', label: 'Pyromancer' },
            { value: 'storm', label: 'Stormbreaker' },
        ],
    },
    { id: 'strength', label: 'Strength', type: 'range' as const, min: 1, max: 20 },
    { id: 'agility', label: 'Agility', type: 'range' as const, min: 1, max: 20 },
    { id: 'intellect', label: 'Intellect', type: 'range' as const, min: 1, max: 20 },
    { id: 'origin', label: 'Origin', type: 'text' as const },
]

const CharacterCreateDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('')

    useEffect(() => {
        const el: any = ref.current
        if (el) {
            el.fields = FIELDS
            el.values = { race: 'human', class: 'warden', strength: 12, agility: 10, intellect: 8, origin: '' }
        }
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onName = (event: any) => setLast(`name:${event.detail.value}`)
        const onChange = (event: any) => setLast(`${event.detail.id}=${event.detail.value}`)
        const onConfirm = (event: any) => setLast(`confirm: ${event.detail.name || '(no name)'}`)
        el.addEventListener('name', onName)
        el.addEventListener('change', onChange)
        el.addEventListener('confirm', onConfirm)
        return () => {
            el.removeEventListener('name', onName)
            el.removeEventListener('change', onChange)
            el.removeEventListener('confirm', onConfirm)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Character Create"
                        description="Form-driven character builder: name input, mixed-type fields, confirm action."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last event: ${last || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-character-create ref={ref} />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterCreateDemo
