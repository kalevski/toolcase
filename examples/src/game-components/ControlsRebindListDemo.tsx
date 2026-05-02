import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const BINDINGS = [
    { id: 'forward', action: 'Move Forward', key: 'W' },
    { id: 'backward', action: 'Move Backward', key: 'S' },
    { id: 'left', action: 'Strafe Left', key: 'A' },
    { id: 'right', action: 'Strafe Right', key: 'D' },
    { id: 'jump', action: 'Jump', key: 'Space' },
    { id: 'crouch', action: 'Crouch', key: 'C' },
    { id: 'interact', action: 'Interact', key: 'E' },
    { id: 'inventory', action: 'Inventory', key: 'I' },
    { id: 'sprint', action: 'Sprint' },
]

const ControlsRebindListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.bindings = BINDINGS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setLast(`rebind ${event.detail.id}`)
        el.addEventListener('rebind', handler)
        return () => el.removeEventListener('rebind', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Controls Rebind List"
                        description="List of action rows with current key glyph + Rebind affordance. Emits rebind on row click."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 480, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-controls-rebind-list ref={ref} />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ControlsRebindListDemo
