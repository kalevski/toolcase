import React from 'react'

const RadioDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Radio"
                        description="Bootstrap radio button wrapper with label, grouping via name, inline/reverse layout, and disabled support."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Default Group">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-radio label="Option 1" name="group1" value="1" checked />
                                {/* @ts-ignore */}
                                <tc-radio label="Option 2" name="group1" value="2" />
                                {/* @ts-ignore */}
                                <tc-radio label="Option 3" name="group1" value="3" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Inline">
                            <div>
                                {/* @ts-ignore */}
                                <tc-radio label="Option A" name="group2" value="a" inline checked />
                                {/* @ts-ignore */}
                                <tc-radio label="Option B" name="group2" value="b" inline />
                                {/* @ts-ignore */}
                                <tc-radio label="Option C" name="group2" value="c" inline />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-radio
                                    label="Disabled unchecked"
                                    name="group3"
                                    value="x"
                                    disabled
                                />
                                {/* @ts-ignore */}
                                <tc-radio
                                    label="Disabled checked"
                                    name="group3"
                                    value="y"
                                    checked
                                    disabled
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Reverse">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-radio label="Reverse layout" name="group4" value="r1" reverse />
                                {/* @ts-ignore */}
                                <tc-radio
                                    label="Reverse checked"
                                    name="group4"
                                    value="r2"
                                    reverse
                                    checked
                                />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RadioDemo
