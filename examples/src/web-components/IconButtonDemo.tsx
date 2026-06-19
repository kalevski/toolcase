import React from 'react'

const VARIANTS = ['primary', 'secondary', 'info', 'success', 'warning', 'danger'] as const
const SIZES = ['small', 'default', 'large'] as const

const IconButtonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Icon Button"
                        description="Square icon-only button with size and variant options."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Sizes (secondary)">
                            <div className="d-flex flex-wrap align-items-center gap-3">
                                {SIZES.map((size) => (
                                    /* @ts-ignore */
                                    <tc-icon-button
                                        key={size}
                                        icon="Pencil"
                                        size={size}
                                        label={`Edit (${size})`}
                                    />
                                ))}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Solid variants">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {VARIANTS.map((variant) => (
                                    /* @ts-ignore */
                                    <tc-icon-button
                                        key={variant}
                                        icon="Star"
                                        variant={variant}
                                        label={variant}
                                    />
                                ))}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Outline variants">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {VARIANTS.map((variant) => (
                                    /* @ts-ignore */
                                    <tc-icon-button
                                        key={variant}
                                        icon="Heart"
                                        variant={variant}
                                        outline
                                        label={`${variant} outline`}
                                    />
                                ))}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* @ts-ignore */}
                                <tc-icon-button icon="Trash2" label="Delete" disabled />
                                {/* @ts-ignore */}
                                <tc-icon-button
                                    icon="Trash2"
                                    variant="danger"
                                    label="Delete"
                                    disabled
                                />
                                {/* @ts-ignore */}
                                <tc-icon-button
                                    icon="Trash2"
                                    variant="danger"
                                    outline
                                    label="Delete"
                                    disabled
                                />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default IconButtonDemo
