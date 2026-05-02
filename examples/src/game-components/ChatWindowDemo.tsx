import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const CHANNELS = [
    { id: 'all', label: 'All', color: '#f0d27a' },
    { id: 'team', label: 'Team', color: '#5a8cf0' },
    { id: 'guild', label: 'Guild', color: '#9fc55a' }
]

const INITIAL = [
    { id: '1', sender: 'Aldric', body: 'Pushing mid lane.', color: '#f0d27a' },
    { id: '2', sender: 'Brina', body: 'On my way.', color: '#5a8cf0' },
    { id: '3', sender: '', body: 'Wave 4 incoming', system: true }
]

const ChatWindowDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.channels = CHANNELS
        el.messages = INITIAL
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSend = (e: any) => {
            const detail = e.detail
            setLast(`send #${detail.channel}: ${detail.text}`)
            const next = [...((el as any).messages as any[]), { id: String(Date.now()), sender: 'You', body: detail.text }]
            ;(el as any).messages = next
        }
        const onChannel = (e: any) => setLast(`channel ${e.detail.id}`)
        el.addEventListener('send', onSend)
        el.addEventListener('channel-change', onChannel)
        return () => {
            el.removeEventListener('send', onSend)
            el.removeEventListener('channel-change', onChannel)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="ChatWindow"
                        description="Multi-channel chat panel with tabs, message log, and compose input."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            {/* @ts-ignore */}
                            <gc-chat-window ref={ref} active-channel="all" width="420" height="320" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChatWindowDemo
