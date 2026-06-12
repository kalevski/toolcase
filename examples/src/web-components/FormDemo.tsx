import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FormDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Form"
                        description="Bootstrap form wrapper with client-side validation. On submit, checkValidity() runs — invalid submissions reveal feedback without a page reload."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Registration (try submitting empty)">
                            <div style={{ maxWidth: 480 }}>
                                {/* @ts-ignore */}
                                <tc-form novalidate>
                                    <div className="d-flex flex-column gap-3">
                                        {/* @ts-ignore */}
                                        <tc-input label="Full Name" placeholder="Jane Smith" required />
                                        {/* @ts-ignore */}
                                        <tc-input label="Email address" type="email" placeholder="name@example.com" required />
                                        {/* @ts-ignore */}
                                        <tc-input label="Password" type="password" placeholder="Create a password" required />
                                        <button type="submit" className="btn btn-primary">Create account</button>
                                    </div>
                                {/* @ts-ignore */}
                                </tc-form>
                            </div>
                        </SectionCard>

                        <SectionCard title="Contact Form">
                            <div style={{ maxWidth: 480 }}>
                                {/* @ts-ignore */}
                                <tc-form novalidate>
                                    <div className="d-flex flex-column gap-3">
                                        {/* @ts-ignore */}
                                        <tc-input label="Name" placeholder="Your name" required />
                                        {/* @ts-ignore */}
                                        <tc-input label="Email" type="email" placeholder="you@example.com" required />
                                        {/* @ts-ignore */}
                                        <tc-textarea label="Message" placeholder="Write your message…" required rows="4" />
                                        <button type="submit" className="btn btn-outline-primary">Send message</button>
                                    </div>
                                {/* @ts-ignore */}
                                </tc-form>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default FormDemo
