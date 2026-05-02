import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const NODES = [
    { id: 's1', x: 100, y: 200, label: 'Strike', icon: '⚔', unlocked: true, rank: 3, maxRank: 3 },
    { id: 's2', x: 240, y: 120, label: 'Parry', icon: '🛡', unlocked: true, rank: 1, maxRank: 3 },
    { id: 's3', x: 240, y: 280, label: 'Stance', icon: '✦', unlocked: true, rank: 2, maxRank: 3 },
    { id: 's4', x: 380, y: 120, label: 'Riposte', icon: '⚔', rank: 0, maxRank: 3 },
    { id: 's5', x: 380, y: 280, label: 'Endure', icon: '☩', rank: 0, maxRank: 3 },
    { id: 's6', x: 520, y: 200, label: 'Mastery', icon: '❖', locked: true, rank: 0, maxRank: 1 }
]

const EDGES = [
    { from: 's1', to: 's2' },
    { from: 's1', to: 's3' },
    { from: 's2', to: 's4' },
    { from: 's3', to: 's5' },
    { from: 's4', to: 's6' },
    { from: 's5', to: 's6' }
]

const SkillTreeDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.nodes = NODES
        el.edges = EDGES
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (e: any) => setLast(`select ${e.detail.id}`)
        const onUnlock = (e: any) => setLast(`unlock ${e.detail.id}`)
        el.addEventListener('select', onSelect)
        el.addEventListener('unlock', onUnlock)
        return () => {
            el.removeEventListener('select', onSelect)
            el.removeEventListener('unlock', onUnlock)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="SkillTree"
                        description="Talent tree with diamond-rotated nodes, unlock edges, ranks, and remaining-points readout."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            {/* @ts-ignore */}
                            <gc-skill-tree ref={ref} selected-id="s4" points="3" width="620" height="380" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SkillTreeDemo
