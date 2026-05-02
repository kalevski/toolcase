import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const FRIENDS = [
    { id: '1', name: 'Aldric', status: 'in-game', activity: 'Wandering the wilds', rank: 'Bronze' },
    { id: '2', name: 'Brina', status: 'online' },
    { id: '3', name: 'Caelum', status: 'busy', activity: 'Boss fight' },
    { id: '4', name: 'Dorin', status: 'away', activity: 'AFK 5m' },
    { id: '5', name: 'Eira', status: 'offline' }
]

const FriendsListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.friends = FRIENDS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onInvite = (e: any) => setLast(`invite ${e.detail.id}`)
        const onMessage = (e: any) => setLast(`message ${e.detail.id}`)
        el.addEventListener('invite', onInvite)
        el.addEventListener('message', onMessage)
        return () => {
            el.removeEventListener('invite', onInvite)
            el.removeEventListener('message', onMessage)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="FriendsList"
                        description="Sortable friends roster with status pip, activity line, and per-row invite/message actions."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            <div style={{ maxWidth: 480, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-friends-list ref={ref} list-title="Friends" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FriendsListDemo
