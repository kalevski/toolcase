import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FriendsListDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const rankedRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)
    const titledRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.friends = [
                { id: '1', name: 'Aria', status: 'online' },
                { id: '2', name: 'Kestrel', status: 'in-game', activity: 'Ranked — Round 3' },
                { id: '3', name: 'Vesper', status: 'busy', activity: 'Do not disturb' },
                { id: '4', name: 'Lumen', status: 'away', activity: 'Away' },
                { id: '5', name: 'Onyx', status: 'offline' },
            ]
        }
    }, [])

    useEffect(() => {
        if (rankedRef.current) {
            rankedRef.current.friends = [
                { id: '1', name: 'Aria', status: 'in-game', activity: 'Capture the Flag', rank: 'Diamond' },
                { id: '2', name: 'Kestrel', status: 'online', rank: 'Platinum' },
                { id: '3', name: 'Vesper', status: 'online', rank: 'Gold' },
                { id: '4', name: 'Onyx', status: 'offline', rank: 'Silver' },
            ]
        }
    }, [])

    useEffect(() => {
        if (titledRef.current) {
            titledRef.current.friends = [
                { id: '1', name: 'Nova', status: 'online' },
                { id: '2', name: 'Quill', status: 'away', activity: 'Idle 12m' },
                { id: '3', name: 'Sable', status: 'offline' },
            ]
        }
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.friends = [
            { id: 'a', name: 'Aria', status: 'online' },
            { id: 'b', name: 'Kestrel', status: 'in-game', activity: 'In lobby' },
            { id: 'c', name: 'Vesper', status: 'busy' },
        ]
        const onInvite = (e: any) => setLog(l => [`invite → ${e.detail.id}`, ...l].slice(0, 5))
        const onMessage = (e: any) => setLog(l => [`message → ${e.detail.id}`, ...l].slice(0, 5))
        el.addEventListener('tc-invite', onInvite)
        el.addEventListener('tc-message', onMessage)
        return () => {
            el.removeEventListener('tc-invite', onInvite)
            el.removeEventListener('tc-message', onMessage)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="FriendsList"
                            description="Friends roster with online/status pips, activity text, optional rank chips, and message/invite actions. Friends are set via the JS friends property; rows are auto-sorted by status (in-game → online → busy → away → offline) then name."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Statuses">
                                {/* @ts-ignore */}
                                <tc-friends-list ref={basicRef} style={{ maxWidth: '420px' }} />
                            </SectionCard>

                            <SectionCard title="With rank chips">
                                {/* @ts-ignore */}
                                <tc-friends-list ref={rankedRef} style={{ maxWidth: '420px' }} />
                            </SectionCard>

                            <SectionCard title="Custom list title">
                                {/* @ts-ignore */}
                                <tc-friends-list ref={titledRef} list-title="Squad" style={{ maxWidth: '420px' }} />
                            </SectionCard>

                            <SectionCard title="Invite / message events">
                                {/* @ts-ignore */}
                                <tc-friends-list ref={eventsRef} style={{ maxWidth: '420px' }} />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click a message or invite action…</span>
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

export default FriendsListDemo
