import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LabelDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Label"
                        description="Semantic form label with optional required indicator and info-icon tooltip. Port of @toolcase/react-components Label."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Plain label">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-label>Username</tc-label>
                                {/* @ts-ignore */}
                                <tc-label>Email address</tc-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Required indicator">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-label required>Password</tc-label>
                                {/* @ts-ignore */}
                                <tc-label required>Full name</tc-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Tooltip (info icon)">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-label tooltip="Your username is shown publicly on your profile">Username</tc-label>
                                {/* @ts-ignore */}
                                <tc-label required tooltip="Must be at least 8 characters and include a number">Password</tc-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-label size="small" required tooltip="Small size">Small label</tc-label>
                                {/* @ts-ignore */}
                                <tc-label size="default" required tooltip="Default size">Default label</tc-label>
                                {/* @ts-ignore */}
                                <tc-label size="large" required tooltip="Large size">Large label</tc-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Wired to tc-input via for attribute">
                            <div className="d-flex flex-column gap-1" style={{ maxWidth: 320 }}>
                                {/* @ts-ignore */}
                                <tc-label for="demo-username" required tooltip="Your unique identifier on the platform">Username</tc-label>
                                {/* @ts-ignore */}
                                <tc-input id="demo-username" type="text" placeholder="johndoe"></tc-input>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default LabelDemo
