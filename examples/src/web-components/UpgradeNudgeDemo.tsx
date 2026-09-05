import React, { useState } from 'react'

const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem' }
const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const UpgradeNudgeDemo: React.FC = () => {
    const [locked, setLocked] = useState(true)
    const [clicks, setClicks] = useState(0)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="UpgradeNudge"
                            description="The inline paywall pitch: a lock chip, one sentence, and the call to action. polovni.mk, webgame.cloud and mindmap wrote this within two lines of each other."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Entitlements
                            </tc-badge>
                        </tc-rich-page-header>

                        <div style={wrap} className="mt-4">
                            <tc-section-card title="Inline — the row inside a panel">
                                <tc-upgrade-nudge
                                    locked={locked}
                                    role-name="Pro"
                                    blurb="Market medians and price history for every model."
                                    cta-label="Upgrade"
                                    ontc-upgrade={() => setClicks((c) => c + 1)}
                                />
                                <div className="d-flex gap-2 mt-3">
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        onClick={() => setLocked((v) => !v)}
                                    >
                                        {locked ? 'Unlock' : 'Lock again'}
                                    </tc-button>
                                    <span className="align-self-center text-body-secondary">
                                        tc-upgrade fired {clicks}×
                                    </span>
                                </div>
                                <p style={note} className="mt-3">
                                    It renders nothing once the entitlement is present, which is
                                    what makes it safe to leave in the tree unconditionally: the
                                    caller flips one attribute rather than mounting and unmounting a
                                    block.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Panel — the boxed pitch">
                                <tc-upgrade-nudge
                                    variant="panel"
                                    role-name="Team"
                                    blurb="Shared rulesets, versioned, with a dry run before anything applies."
                                    cta-label="See the plans"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default UpgradeNudgeDemo
