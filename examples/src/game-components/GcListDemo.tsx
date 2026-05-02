import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ITEMS = [
    { id: 'sword', label: 'Iron Long-sword', icon: '⚔', meta: '12 g' },
    { id: 'shield', label: 'Oak Buckler', icon: '🛡', meta: '8 g' },
    { id: 'potion', label: 'Mana Draught', icon: '✦', meta: '24 g' },
    { id: 'tome', label: 'Tome of Rites', icon: '◈', meta: '120 g', disabled: true },
    { id: 'key', label: 'Brass Key', icon: '☩', meta: '—' },
]

const GcListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [selected, setSelected] = useState('sword')

    useEffect(() => {
        const el: any = ref.current
        if (el) el.items = ITEMS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setSelected(event.detail.id)
        el.addEventListener('select', handler)
        return () => el.removeEventListener('select', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="List"
                        description="Generic selectable list with icon/label/meta cells. Emits select."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Selected: ${selected}`} />
                            <div style={{ maxWidth: 420, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-list ref={ref} selected-id={selected} />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GcListDemo
