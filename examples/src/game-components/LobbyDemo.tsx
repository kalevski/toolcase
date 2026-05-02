import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const PLAYERS = [
    { id: '1', name: 'Aldric', host: true, ready: true, rank: 'Gold' },
    { id: '2', name: 'Brina', ready: true, rank: 'Silver' },
    { id: '3', name: 'Caelum', rank: 'Gold' },
    { id: '4', name: 'Dorin', ready: true, rank: 'Bronze' }
]

const LobbyDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.players = PLAYERS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onLeave = () => setLast('leave')
        const onReady = () => setLast('ready toggle')
        const onStart = () => setLast('start match')
        el.addEventListener('leave', onLeave)
        el.addEventListener('ready', onReady)
        el.addEventListener('start', onStart)
        return () => {
            el.removeEventListener('leave', onLeave)
            el.removeEventListener('ready', onReady)
            el.removeEventListener('start', onStart)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Lobby"
                        description="Match lobby with mode/map meta, ready slots, host start button, and ready/leave actions."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <div style={{ maxWidth: 720 }}>
                                {/* @ts-ignore */}
                                <gc-lobby ref={ref} capacity="6" lobby-mode="Conquest" map-name="Ember Keep" can-start />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LobbyDemo
