import React from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const heading: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontWeight: 650,
    fontSize: '0.9375rem',
}

const HintTipDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="HintTip"
                        description="A sentence a heading can carry without spending a line on it."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Mobile
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-3 mt-4">
                        <tc-section-card title="Beside a heading">
                            <div style={heading}>
                                Power per litre
                                <tc-hint-tip text="How much power the engine makes for its size. Higher figures mean a more strained engine, which usually means a shorter life between rebuilds." />
                            </div>
                            <p style={note} className="mt-2">
                                Every spec block used to open with a lead paragraph explaining the
                                figures under it. Read once, it is the reason the block makes sense;
                                read on every visit it is a paragraph between the reader and the
                                bars. The tip keeps the sentence one tap from the heading and gives
                                the block back its first line.
                            </p>
                        </tc-section-card>

                        <tc-section-card title="Why the trigger is click">
                            <div style={heading}>
                                Top placement
                                <tc-hint-tip
                                    placement="top"
                                    text="Opens above, for a heading at the bottom of a card."
                                />
                                Right placement
                                <tc-hint-tip placement="right" text="Opens to the side." />
                            </div>
                            <p style={note} className="mt-2">
                                <code>tc-tooltip</code> wraps something else and defaults to{' '}
                                <code>hover focus</code>. This one <em>is</em> the trigger and its
                                trigger is <code>click</code> — there is no hover on a phone, so a
                                hover tip beside a heading is a sentence a touch reader can never
                                read. A real button fires <code>click</code> on Enter and Space too,
                                so one trigger covers tap, mouse and keyboard.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default HintTipDemo
