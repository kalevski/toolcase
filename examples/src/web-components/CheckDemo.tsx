import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CheckDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Check"
                        description="Bootstrap checkbox wrapper with label, inline/reverse layout, indeterminate state, validation, and disabled support."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Default checkbox" value="option1" />
                                {/* @ts-ignore */}
                                <tc-check label="Checked checkbox" value="option2" checked />
                            </div>
                        </SectionCard>

                        <SectionCard title="Inline">
                            <div>
                                {/* @ts-ignore */}
                                <tc-check label="Option 1" value="a" inline />
                                {/* @ts-ignore */}
                                <tc-check label="Option 2" value="b" inline checked />
                                {/* @ts-ignore */}
                                <tc-check label="Option 3" value="c" inline />
                            </div>
                        </SectionCard>

                        <SectionCard title="Indeterminate">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Indeterminate state" indeterminate />
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Disabled unchecked" disabled />
                                {/* @ts-ignore */}
                                <tc-check label="Disabled checked" checked disabled />
                            </div>
                        </SectionCard>

                        <SectionCard title="Validation States">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Valid checkbox" state="valid" checked />
                                {/* @ts-ignore */}
                                <tc-check label="Invalid checkbox" state="invalid" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Reverse">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Reverse layout" reverse />
                                {/* @ts-ignore */}
                                <tc-check label="Reverse checked" reverse checked />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CheckDemo
