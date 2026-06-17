import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PLAYERS = [
    { id: '1', name: 'ToxicWizard92', mutedAt: '2d ago', reason: 'Spam' },
    { id: '2', name: 'ChatBot_AFK', mutedAt: '1w ago' },
    { id: '3', name: 'Griefer404', mutedAt: '1mo ago', reason: 'Harassment' },
]

const MuteListDemo: React.FC = () => {
    const populatedRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)
    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!populatedRef.current) return
        populatedRef.current.players = PLAYERS
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.players = PLAYERS.slice(0, 2)
        const handler = (e: CustomEvent) =>
            setLog(l => [`tc-unmute — id: "${e.detail.id}"`, ...l].slice(0, 8))
        el.addEventListener('tc-unmute', handler as EventListener)
        return () => el.removeEventListener('tc-unmute', handler as EventListener)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="MuteList"
                            description="A list of muted players with optional reason, timestamp, and a per-row Unmute button. Players are set via the JS players property. Clicking Unmute fires tc-unmute with the player id."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Populated — name, reason, and timestamp">
                                {/* @ts-ignore */}
                                <tc-mute-list ref={populatedRef} style={{ maxWidth: '480px' }} />
                            </SectionCard>

                            <SectionCard title="Empty state">
                                {/* @ts-ignore */}
                                <tc-mute-list style={{ maxWidth: '480px' }} />
                            </SectionCard>

                            <SectionCard title="Events — tc-unmute">
                                {/* @ts-ignore */}
                                <tc-mute-list ref={eventsRef} style={{ maxWidth: '480px' }} />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click Unmute…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MuteListDemo
