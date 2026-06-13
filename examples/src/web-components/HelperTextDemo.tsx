import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const HelperTextDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="HelperText"
                        description="Contextual helper text with variant-specific icons. Pair with form inputs via aria-describedby."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants (text attribute)">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-helper-text variant="default" text="Default helper text"></tc-helper-text>
                                {/* @ts-ignore */}
                                <tc-helper-text variant="success" text="Your password is strong"></tc-helper-text>
                                {/* @ts-ignore */}
                                <tc-helper-text variant="warning" text="This field will be publicly visible"></tc-helper-text>
                                {/* @ts-ignore */}
                                <tc-helper-text variant="error" text="Password must be at least 8 characters"></tc-helper-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted children">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-helper-text variant="default">Use a mix of letters, numbers and symbols</tc-helper-text>
                                {/* @ts-ignore */}
                                <tc-helper-text variant="error">Email already in use — <a href="#">sign in instead</a></tc-helper-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom icon override">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-helper-text variant="default" icon="HelpCircle" text="Need help? Check our documentation"></tc-helper-text>
                                {/* @ts-ignore */}
                                <tc-helper-text variant="success" icon="ShieldCheck" text="Your data is encrypted and secure"></tc-helper-text>
                                {/* @ts-ignore */}
                                <tc-helper-text variant="warning" icon="Clock" text="Changes take effect within 24 hours"></tc-helper-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="Paired with input via aria-describedby">
                            <div className="d-flex flex-column gap-1" style={{ maxWidth: 320 }}>
                                <label htmlFor="demo-email" className="form-label">Email address</label>
                                <input
                                    id="demo-email"
                                    type="email"
                                    className="form-control"
                                    aria-describedby="demo-email-hint"
                                    placeholder="you@example.com"
                                />
                                {/* @ts-ignore */}
                                <tc-helper-text variant="default" text="We'll never share your email" id="demo-email-hint"></tc-helper-text>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default HelperTextDemo
