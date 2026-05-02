import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ENTRIES = [
    {
        id: 'goblin',
        name: 'Goblin',
        icon: '◆',
        discovered: true,
        description: 'Small, quick, and cowardly. Travels in packs and avoids open ground.',
        stats: [
            { label: 'HP', value: 24 },
            { label: 'XP', value: 12 }
        ]
    },
    {
        id: 'wraith',
        name: 'Wraith',
        icon: '✦',
        discovered: true,
        description: 'A spectral remnant of fallen warriors. Drains mana on contact.'
    },
    { id: 'dragon', name: 'Dragon', discovered: false }
]

const CodexDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.entries = ENTRIES
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
                        title="Codex"
                        description="Bestiary/lore index with discovered/undiscovered entries and a detail pane."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 720 }}>
                                {/* @ts-ignore */}
                                <gc-codex ref={ref} selected-id="goblin" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CodexDemo
