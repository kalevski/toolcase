import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const PLAYERS = [
    { id: '1', name: 'ToxicWizard92', mutedAt: '2d ago', reason: 'Spam' },
    { id: '2', name: 'ChatBot_AFK', mutedAt: '1w ago' },
    { id: '3', name: 'Griefer404', mutedAt: '1mo ago', reason: 'Harassment' }
]

const MuteListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const emptyRef = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.players = PLAYERS
    }, [])

    useEffect(() => {
        const el = emptyRef.current as any
        if (!el) return
        el.players = []
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: any) => setLast(`unmute ${e.detail.id}`)
        el.addEventListener('unmute', handler)
        return () => el.removeEventListener('unmute', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="MuteList"
                        description="List of muted players with reason, timestamp, and per-row unmute action."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Populated — ${last}`}>
                            <div style={{ maxWidth: 460, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-mute-list ref={ref} />
                            </div>
                        </SectionCard>
                        <SectionCard title="Empty">
                            <div style={{ maxWidth: 460, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-mute-list ref={emptyRef} />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MuteListDemo
