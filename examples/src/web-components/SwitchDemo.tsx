import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SwitchDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Switch"
                        description="Bootstrap toggle-switch wrapper with label, reverse layout, and disabled support."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-switch label="Default switch" value="option1" />
                                {/* @ts-ignore */}
                                <tc-switch label="Checked switch" value="option2" checked />
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-switch label="Disabled unchecked" disabled />
                                {/* @ts-ignore */}
                                <tc-switch label="Disabled checked" checked disabled />
                            </div>
                        </SectionCard>

                        <SectionCard title="Reverse">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-switch label="Reverse layout" reverse />
                                {/* @ts-ignore */}
                                <tc-switch label="Reverse checked" reverse checked />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SwitchDemo
