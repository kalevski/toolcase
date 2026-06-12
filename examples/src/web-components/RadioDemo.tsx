import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const RadioDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Radio"
                        description="Bootstrap radio button wrapper with label, grouping via name, inline/reverse layout, and disabled support."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default Group">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-radio label="Option 1" name="group1" value="1" checked />
                                {/* @ts-ignore */}
                                <tc-radio label="Option 2" name="group1" value="2" />
                                {/* @ts-ignore */}
                                <tc-radio label="Option 3" name="group1" value="3" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Inline">
                            <div>
                                {/* @ts-ignore */}
                                <tc-radio label="Option A" name="group2" value="a" inline checked />
                                {/* @ts-ignore */}
                                <tc-radio label="Option B" name="group2" value="b" inline />
                                {/* @ts-ignore */}
                                <tc-radio label="Option C" name="group2" value="c" inline />
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-radio label="Disabled unchecked" name="group3" value="x" disabled />
                                {/* @ts-ignore */}
                                <tc-radio label="Disabled checked" name="group3" value="y" checked disabled />
                            </div>
                        </SectionCard>

                        <SectionCard title="Reverse">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-radio label="Reverse layout" name="group4" value="r1" reverse />
                                {/* @ts-ignore */}
                                <tc-radio label="Reverse checked" name="group4" value="r2" reverse checked />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RadioDemo
