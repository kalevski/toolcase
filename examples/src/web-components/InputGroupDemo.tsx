import React from 'react'

const InputGroupDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Input Group"
                        description="Bootstrap input group wrapper that joins text addons and controls in source order."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Text Prepend">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input-group>
                                    {/* @ts-ignore */}
                                    <tc-input-group-text>@</tc-input-group-text>
                                    <input
                                        class="form-control"
                                        type="text"
                                        placeholder="Username"
                                    />
                                    {/* @ts-ignore */}
                                </tc-input-group>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Button Append">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input-group>
                                    <input class="form-control" type="text" placeholder="Search…" />
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Search</tc-button>
                                    {/* @ts-ignore */}
                                </tc-input-group>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Text Prepend + Append">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input-group>
                                    {/* @ts-ignore */}
                                    <tc-input-group-text>$</tc-input-group-text>
                                    <input class="form-control" type="number" placeholder="0.00" />
                                    {/* @ts-ignore */}
                                    <tc-input-group-text>.00</tc-input-group-text>
                                    {/* @ts-ignore */}
                                </tc-input-group>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-column gap-2" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-input-group size="sm">
                                    {/* @ts-ignore */}
                                    <tc-input-group-text>Small</tc-input-group-text>
                                    <input class="form-control" type="text" />
                                    {/* @ts-ignore */}
                                </tc-input-group>
                                {/* @ts-ignore */}
                                <tc-input-group>
                                    {/* @ts-ignore */}
                                    <tc-input-group-text>Default</tc-input-group-text>
                                    <input class="form-control" type="text" />
                                    {/* @ts-ignore */}
                                </tc-input-group>
                                {/* @ts-ignore */}
                                <tc-input-group size="lg">
                                    {/* @ts-ignore */}
                                    <tc-input-group-text>Large</tc-input-group-text>
                                    <input class="form-control" type="text" />
                                    {/* @ts-ignore */}
                                </tc-input-group>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default InputGroupDemo
