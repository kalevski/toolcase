import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const InviteToastDemo: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [lastResult, setLastResult] = useState<string>('—')
    const ref = useTcEvents<HTMLElement>({
        'tc-accept': () => {
            setLastResult('Accepted the invite')
            setOpen(false)
        },
        'tc-decline': () => {
            setLastResult('Declined the invite (button or timeout)')
            setOpen(false)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Invite Toast"
                            description="Transient invite popup pinned to the top-right corner with accept / decline actions and an auto-decline countdown bar. Controlled component — fires tc-accept or tc-decline; set open to false in the handler to dismiss."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="last action">
                                <code>{lastResult}</code>
                            </tc-section-card>

                            <tc-section-card title="interactive — short timeout">
                                <p className="text-muted mb-3">
                                    Opens the toast top-right. Accept or decline, or let the
                                    8-second countdown lapse to auto-decline.
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
                            </tc-section-card>
                        </div>

                        {/* @ts-ignore */}
                        <tc-invite-toast
                            ref={ref}
                            open={open}
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
