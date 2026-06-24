import React from 'react'

const FormDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Form"
                        description="Bootstrap form wrapper with client-side validation. On submit, checkValidity() runs — invalid submissions reveal feedback without a page reload."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Registration (try submitting empty)">
                            <div style={{ maxWidth: 480 }}>
                                {/* @ts-ignore */}
                                <tc-form novalidate>
                                    <div className="d-flex flex-column gap-3">
                                        {/* @ts-ignore */}
                                        <tc-input
                                            label="Full Name"
                                            placeholder="Jane Smith"
                                            required
                                        />
                                        {/* @ts-ignore */}
                                        <tc-input
                                            label="Email address"
                                            type="email"
                                            placeholder="name@example.com"
                                            required
                                        />
                                        {/* @ts-ignore */}
                                        <tc-input
                                            label="Password"
                                            type="password"
                                            placeholder="Create a password"
                                            required
                                        />
                                        <button type="submit" className="btn btn-primary">
                                            Create account
                                        </button>
                                    </div>
                                    {/* @ts-ignore */}
                                </tc-form>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Contact Form">
                            <div style={{ maxWidth: 480 }}>
                                {/* @ts-ignore */}
                                <tc-form novalidate>
                                    <div className="d-flex flex-column gap-3">
                                        {/* @ts-ignore */}
                                        <tc-input label="Name" placeholder="Your name" required />
                                        {/* @ts-ignore */}
                                        <tc-input
                                            label="Email"
                                            type="email"
                                            placeholder="you@example.com"
                                            required
                                        />
                                        {/* @ts-ignore */}
                                        <tc-textarea
                                            label="Message"
                                            placeholder="Write your message…"
                                            required
                                            rows="4"
                                        />
                                        <button type="submit" className="btn btn-outline-primary">
                                            Send message
                                        </button>
                                    </div>
                                    {/* @ts-ignore */}
                                </tc-form>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default FormDemo
