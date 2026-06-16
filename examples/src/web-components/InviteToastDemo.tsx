import React, { useRef, useState, useEffect } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const InviteToastDemo: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [lastResult, setLastResult] = useState<string>('—')
    const ref = useRef<HTMLElement | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onAccept = () => {
            setLastResult('Accepted the invite')
            setOpen(false)
        }
        const onDecline = () => {
            setLastResult('Declined the invite (button or timeout)')
            setOpen(false)
        }
        el.addEventListener('tc-accept', onAccept)
        el.addEventListener('tc-decline', onDecline)
        return () => {
            el.removeEventListener('tc-accept', onAccept)
            el.removeEventListener('tc-decline', onDecline)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Invite Toast"
                            description="Transient invite popup pinned to the top-right corner with accept / decline actions and an auto-decline countdown bar. Controlled component — fires tc-accept or tc-decline; set open to false in the handler to dismiss."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="last action">
                                <code>{lastResult}</code>
                            </SectionCard>

                            <SectionCard title="interactive — short timeout">
                                <p className="text-muted mb-3">
                                    Opens the toast top-right. Accept or decline, or let the 8-second
                                    countdown lapse to auto-decline.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    disabled={open}
                                    onClick={() => {
                                        setLastResult('Awaiting response…')
                                        setOpen(true)
                                    }}
                                >
                                    Send invite…
                                </button>
                            </SectionCard>
                        </div>

                        {/* @ts-ignore */}
                        <tc-invite-toast
                            ref={(el: HTMLElement | null) => {
                                ref.current = el
                            }}
                            open={open || undefined}
                            inviter="Ada Lovelace"
                            body="Wants to invite you to the Analytical Engine party."
                            timeout-seconds="8"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InviteToastDemo
