import React, { useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const SignInGateDemo: React.FC = () => {
    const [tapped, setTapped] = useState(0)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SignInGate"
                            description="The member wall, as a page body. It renders instead of the data, never over it."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Auth
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Instead of the data">
                                <tc-sign-in-gate
                                    icon="Lock"
                                    heading="Sign in to see saved searches"
                                    lead="It takes a moment and costs nothing — your searches follow you to every device."
                                    action-label="Sign in"
                                    footnote="No card, no trial."
                                    ontc-sign-in={() => setTapped((n) => n + 1)}
                                />
                                <p style={note} className="mt-3">
                                    tapped {tapped}× · The action is an <strong>event</strong>, not
                                    a hardcoded href: where login lives is a routing decision, and
                                    an element that assumed <code>/login</code> would be wrong in
                                    every app that mounts its auth somewhere else. Pass{' '}
                                    <code>href</code> when a plain link is right.
                                </p>
                                <p style={note}>
                                    <strong>Never over the data.</strong> A blurred-out answer is
                                    still an answer to anyone who reads the DOM, and it makes the
                                    gate look like a trick — which is why this is a body block with
                                    no scrim and no z-index at all.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SignInGateDemo
