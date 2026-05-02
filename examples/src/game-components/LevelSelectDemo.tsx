import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const NODES = [
    { id: 'n1', x: 80, y: 200, label: '1-1', completed: true, stars: 3, bestStars: 3 },
    { id: 'n2', x: 200, y: 160, label: '1-2', completed: true, stars: 3, bestStars: 2 },
    { id: 'n3', x: 320, y: 200, label: '1-3', stars: 3, bestStars: 1 },
    { id: 'n4', x: 440, y: 140, label: '1-4', locked: true, stars: 3 },
    { id: 'n5', x: 540, y: 220, label: 'Boss', locked: true, stars: 3 }
]

const EDGES = [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' }
]

const LevelSelectDemo: React.FC = () => {
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
        const onConfirm = (e: any) => setLast(`confirm ${e.detail.id}`)
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
                        title="LevelSelect"
                        description="World map with level nodes, connecting edges, locked/completed states, and star ratings."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            {/* @ts-ignore */}
                            <gc-level-select ref={ref} selected-id="n3" width="640" height="320" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LevelSelectDemo
