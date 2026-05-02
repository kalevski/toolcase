import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const InviteToastDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState('')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const accept = () => { setLast('accepted'); setOpen(false) }
        const decline = () => { setLast('declined'); setOpen(false) }
        el.addEventListener('accept', accept)
        el.addEventListener('decline', decline)
        return () => {
            el.removeEventListener('accept', accept)
            el.removeEventListener('decline', decline)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Invite Toast"
                        description="Top-right party invite with countdown. Auto-decline on timer expiry."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Show toast — last: ${last || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-metal-button variant="primary" onClick={() => { setLast(''); setOpen(true) }}>Receive Invite</gc-metal-button>
                        </SectionCard>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-invite-toast
                ref={ref}
                {...(open ? { open: '' } : {})}
                inviter="Brunhilde"
                body="Wants to invite you to a party of four."
                timeout-seconds="15"
            />
        </div>
    )
}

export default InviteToastDemo
