import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const VARIANTS = ['primary', 'secondary', 'info', 'success', 'warning', 'danger'] as const
const SIZES = ['small', 'default', 'large'] as const

const IconButtonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Icon Button"
                        description="Square icon-only button with size and variant options."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Sizes (secondary)">
                            <div className="d-flex flex-wrap align-items-center gap-3">
                                {SIZES.map(size => (
                                    /* @ts-ignore */
                                    <tc-icon-button
                                        key={size}
                                        icon="Pencil"
                                        size={size}
                                        label={`Edit (${size})`}
                                    />
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Solid variants">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {VARIANTS.map(variant => (
                                    /* @ts-ignore */
                                    <tc-icon-button
                                        key={variant}
                                        icon="Star"
                                        variant={variant}
                                        label={variant}
                                    />
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Outline variants">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {VARIANTS.map(variant => (
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
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* @ts-ignore */}
                                <tc-icon-button icon="Trash2" label="Delete" disabled />
                                {/* @ts-ignore */}
                                <tc-icon-button icon="Trash2" variant="danger" label="Delete" disabled />
                                {/* @ts-ignore */}
                                <tc-icon-button icon="Trash2" variant="danger" outline label="Delete" disabled />
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default IconButtonDemo
