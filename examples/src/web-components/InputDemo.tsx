import React from 'react'

const InputDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Input"
                        description="Bootstrap form-control wrapper with label, sizes, validation states, and help text."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Label &amp; Placeholder">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input
                                    label="Email address"
                                    type="email"
                                    placeholder="name@example.com"
                                />
                                {/* @ts-ignore */}
                                <tc-input
                                    label="Password"
                                    type="password"
                                    placeholder="Enter password"
                                />
                                {/* @ts-ignore */}
                                <tc-input placeholder="No label" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Large" size="lg" placeholder="Large input" />
                                {/* @ts-ignore */}
                                <tc-input label="Default" placeholder="Default input" />
                                {/* @ts-ignore */}
                                <tc-input label="Small" size="sm" placeholder="Small input" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Validation States">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input
                                    label="Valid input"
                                    state="valid"
                                    value="looks-good@example.com"
                                />
                                {/* @ts-ignore */}
                                <tc-input
                                    label="Invalid input"
                                    state="invalid"
                                    value="not-an-email"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Help Text">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input
                                    label="Username"
                                    help="Your username must be 3–20 characters long."
                                    placeholder="Choose a username"
                                />
                                {/* @ts-ignore */}
                                <tc-input
                                    label="API key"
                                    help="Keep this secret — treat it like a password."
                                    type="password"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Reserved message slot — alignment">
                            <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
                                Every field reserves one line below the control for
                                hint/valid/invalid text. The columns stay aligned even though only
                                some fields show a message, and a field never changes height when
                                its message appears or disappears.
                            </p>
                            <div className="row g-3">
                                <div className="col-12 col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-input label="First name" value="Ada" />
                                </div>
                                <div className="col-12 col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-input
                                        label="Email"
                                        value="not-an-email"
                                        error="Enter a valid email address."
                                    />
                                </div>
                                <div className="col-12 col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-input
                                        label="Username"
                                        value="ada"
                                        help="3–20 characters."
                                    />
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled &amp; Readonly">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Disabled" disabled value="cannot edit this" />
                                {/* @ts-ignore */}
                                <tc-input label="Readonly" readonly value="read only value" />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default InputDemo
