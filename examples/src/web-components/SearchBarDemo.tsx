import React, { useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const SearchBarDemo: React.FC = () => {
    const [submitted, setSubmitted] = useState('—')
    const [seed, setSeed] = useState('golf')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SearchBar"
                            description="A leading region, one field, and the button that submits it. Four browse pages had this markup character for character."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Browse
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Submit on Enter, or on the button">
                                <tc-search-bar
                                    value={seed}
                                    label="Search cars"
                                    placeholder="Make, model, anything"
                                    ontc-search={(e) => setSubmitted(e.detail.value)}
                                />
                                <p style={note} className="mt-3">
                                    submitted: <strong>{submitted}</strong>
                                </p>
                                <div className="d-flex gap-2">
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        size="sm"
                                        onClick={() => setSeed('passat')}
                                    >
                                        Reseed from the URL
                                    </tc-button>
                                </div>
                                <p style={note} className="mt-3">
                                    <code>enterkeyhint="search"</code> and{' '}
                                    <code>type="search"</code> live here rather than at six call
                                    sites, which is the point of extracting it: the phone keyboard's
                                    submit key is a decision about the app, not about parts.
                                </p>
                                <p style={note}>
                                    The field is <strong>uncontrolled</strong>: <code>value</code>{' '}
                                    seeds it, typing is never rewritten mid-keystroke, and a value
                                    from outside is pushed into the input only when it differs. That
                                    is the same controlled-input contract <code>tc-form-input</code>{' '}
                                    follows, and the reason this needs no <code>key</code> remount
                                    to stay in step with a router.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="A leading region">
                                <tc-search-bar placeholder="Where?" label="Search by place">
                                    <tc-icon slot="leading" name="MapPin" size="18" decorative />
                                </tc-search-bar>
                                <p style={note} className="mt-3">
                                    <code>[slot="leading"]</code> is a region you fill — the place
                                    picker's map mark in the originating app. It stays your node,
                                    ordered first by CSS.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SearchBarDemo
