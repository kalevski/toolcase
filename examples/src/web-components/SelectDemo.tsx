import React from 'react'

const SelectDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Select"
                        description="Bootstrap form-select wrapper with label, sizes, validation states, and tc-option children."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Label &amp; Options">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-select label="Country">
                                    {/* @ts-ignore */}
                                    <tc-option value="">Choose a country…</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="us">United States</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="gb">United Kingdom</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="de">Germany</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                                {/* @ts-ignore */}
                                <tc-select>
                                    {/* @ts-ignore */}
                                    <tc-option value="a">No label</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="b">Option B</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-select label="Large" size="lg">
                                    {/* @ts-ignore */}
                                    <tc-option value="1">Option 1</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="2">Option 2</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                                {/* @ts-ignore */}
                                <tc-select label="Default">
                                    {/* @ts-ignore */}
                                    <tc-option value="1">Option 1</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="2">Option 2</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                                {/* @ts-ignore */}
                                <tc-select label="Small" size="sm">
                                    {/* @ts-ignore */}
                                    <tc-option value="1">Option 1</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="2">Option 2</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Validation States">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-select label="Valid" state="valid">
                                    {/* @ts-ignore */}
                                    <tc-option value="gb" selected>
                                        United Kingdom
                                    </tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="us">United States</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                                {/* @ts-ignore */}
                                <tc-select label="Invalid" state="invalid">
                                    {/* @ts-ignore */}
                                    <tc-option value="">Choose one…</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="a">Option A</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-select label="Disabled select" disabled>
                                    {/* @ts-ignore */}
                                    <tc-option value="a">Option A</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="b" disabled>
                                        Option B (disabled)
                                    </tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="c">Option C</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Multiple">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-select label="Pick several" multiple>
                                    {/* @ts-ignore */}
                                    <tc-option value="html">HTML</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="css">CSS</tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="js" selected>
                                        JavaScript
                                    </tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="ts" selected>
                                        TypeScript
                                    </tc-option>
                                    {/* @ts-ignore */}
                                    <tc-option value="rust">Rust</tc-option>
                                    {/* @ts-ignore */}
                                </tc-select>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SelectDemo
