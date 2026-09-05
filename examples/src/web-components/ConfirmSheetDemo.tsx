import React, { useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const ConfirmSheetDemo: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [answer, setAnswer] = useState('—')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ConfirmSheet"
                            description="“Are you sure”, as a bottom sheet — the phone-shaped sibling of tc-confirm-dialog."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Overlays
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Ask">
                                <div className="d-flex gap-2 align-items-center flex-wrap">
                                    <tc-button variant="danger" onClick={() => setOpen(true)}>
                                        Delete this car
                                    </tc-button>
                                    <span className="text-body-secondary">answer: {answer}</span>
                                </div>

                                <tc-confirm-sheet
                                    open={open}
                                    danger
                                    heading="Delete this car?"
                                    message="The listing and its photos go with it. This cannot be undone."
                                    confirm-label="Delete"
                                    cancel-label="Keep it"
                                    ontc-confirm={() => setAnswer('confirmed')}
                                    ontc-cancel={() => setAnswer('cancelled')}
                                    ontc-sheet-close={() => setOpen(false)}
                                />

                                <p style={note} className="mt-3">
                                    It exists because <code>window.confirm</code> names the browser
                                    rather than the product, cannot say what the consequence is in
                                    the product's voice, and looks different on every machine.
                                </p>
                                <p style={note}>
                                    <strong>Every dismissal is a cancel.</strong> Scrim, Escape,
                                    drag and the cancel button all mean „no", which is what makes a
                                    confirm safe to dismiss by accident; only the confirm button
                                    means „yes".
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConfirmSheetDemo
