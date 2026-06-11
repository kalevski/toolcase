import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const InputDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Input"
                        description="Bootstrap form-control wrapper with label, sizes, validation states, and help text."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Label &amp; Placeholder">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Email address" type="email" placeholder="name@example.com" />
                                {/* @ts-ignore */}
                                <tc-input label="Password" type="password" placeholder="Enter password" />
                                {/* @ts-ignore */}
                                <tc-input placeholder="No label" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Large" size="lg" placeholder="Large input" />
                                {/* @ts-ignore */}
                                <tc-input label="Default" placeholder="Default input" />
                                {/* @ts-ignore */}
                                <tc-input label="Small" size="sm" placeholder="Small input" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Validation States">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Valid input" state="valid" value="looks-good@example.com" />
                                {/* @ts-ignore */}
                                <tc-input label="Invalid input" state="invalid" value="not-an-email" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Help Text">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Username" help="Your username must be 3–20 characters long." placeholder="Choose a username" />
                                {/* @ts-ignore */}
                                <tc-input label="API key" help="Keep this secret — treat it like a password." type="password" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled &amp; Readonly">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input label="Disabled" disabled value="cannot edit this" />
                                {/* @ts-ignore */}
                                <tc-input label="Readonly" readonly value="read only value" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default InputDemo
