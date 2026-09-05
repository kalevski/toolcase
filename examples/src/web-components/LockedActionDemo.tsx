import React, { useState } from 'react'

const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem' }
const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const log: React.CSSProperties = {
    fontFamily: 'var(--tc-font-mono)',
    fontSize: '0.75rem',
    color: 'var(--tc-text-muted)',
}

const LockedActionDemo: React.FC = () => {
    const [last, setLast] = useState('—')
    const [locked, setLocked] = useState(true)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LockedAction"
                            description="An action that, without the entitlement, opens the upgrade path instead of doing what it says. Identical in polovni.mk, webgame.cloud and mindmap."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Entitlements
                            </tc-badge>
                        </tc-rich-page-header>

                        <div style={wrap} className="mt-4">
                            <tc-section-card title="Locked and unlocked">
                                <div className="d-flex flex-column gap-2">
                                    <tc-locked-action
                                        locked={locked}
                                        role-name="Pro"
                                        ontc-locked={() => setLast('tc-locked — open the paywall')}
                                        ontc-action={() => setLast('tc-action — do the thing')}
                                    >
                                        Export everything
                                    </tc-locked-action>
                                    <div style={log}>last: {last}</div>
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        onClick={() => setLocked((v) => !v)}
                                    >
                                        {locked ? 'Grant the entitlement' : 'Take it away'}
                                    </tc-button>
                                </div>
                                <p style={note} className="mt-3">
                                    <strong>aria-disabled, never disabled.</strong> A real{' '}
                                    <code>disabled</code> button is out of the tab order and answers
                                    nothing, so the reader who most needs to know <em>why</em> it
                                    will not work is the one who cannot reach it. This one stays
                                    focusable, announces as unavailable, and the click still lands —
                                    on the upgrade path rather than on the action.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Locked is not disabled">
                                <div className="d-flex gap-2 flex-wrap">
                                    <tc-locked-action locked role-name="Pro">
                                        Available, at a price
                                    </tc-locked-action>
                                    <tc-locked-action disabled>
                                        Genuinely unavailable
                                    </tc-locked-action>
                                </div>
                                <p style={note} className="mt-3">
                                    Two different states with two different answers: the first one
                                    has somewhere to send you, the second has nothing to offer and
                                    takes no click at all.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LockedActionDemo
