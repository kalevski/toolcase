import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ENTRIES = [
    {
        id: 'q1',
        title: 'The Lost Heirloom',
        state: 'active',
        description: 'A noblewoman has lost her family heirloom in the catacombs.',
        body: 'Speak to Lady Elara at the manor, then descend into the catacombs beneath the chapel.',
        objectives: [
            { id: 'o1', label: 'Speak to Lady Elara', completed: true },
            { id: 'o2', label: 'Find the heirloom in the catacombs' },
            { id: 'o3', label: 'Defeat the guardian (optional)', optional: true }
        ],
        rewards: [
            { label: 'Gold', value: 250, icon: '◆' },
            { label: 'XP', value: 1200, icon: '✦' }
        ]
    },
    { id: 'q2', title: 'Wolves at the Gate', state: 'completed', description: 'Hunt the alpha terrorizing the village.' },
    { id: 'q3', title: 'The Stolen Reagents', state: 'failed', description: 'Recover before sundown.' }
]

const JournalDemo: React.FC = () => {
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
                        title="Journal"
                        description="Quest journal with state-coloured rows, objectives checklist, and reward summary."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 760 }}>
                                {/* @ts-ignore */}
                                <gc-journal ref={ref} selected-id="q1" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default JournalDemo
