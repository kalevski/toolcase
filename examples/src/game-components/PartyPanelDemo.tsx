import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const MEMBERS = [
    { id: '1', name: 'Aldric', host: true, ready: true, role: 'Tank' },
    { id: '2', name: 'Brina', ready: true, role: 'Healer' },
    { id: '3', name: 'Caelum', role: 'DPS' }
]

const PartyPanelDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.members = MEMBERS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onLeave = () => setLast('leave')
        const onInvite = () => setLast('invite')
        el.addEventListener('leave', onLeave)
        el.addEventListener('invite', onInvite)
        return () => {
            el.removeEventListener('leave', onLeave)
            el.removeEventListener('invite', onInvite)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="PartyPanel"
                        description="Compact party roster with ready state, host badge, role, and invite/leave actions."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 420 }}>
                                {/* @ts-ignore */}
                                <gc-party-panel ref={ref} capacity="4" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PartyPanelDemo
