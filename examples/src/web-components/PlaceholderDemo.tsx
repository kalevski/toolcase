import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PlaceholderDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Placeholder"
                        description="Bootstrap loading skeletons wrapped as a custom element. Supports col-span widths, size variants, glow/wave animations, and theme colours."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Col widths">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="8"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="4"></tc-placeholder>
                            </div>
                        </SectionCard>

                        <SectionCard title="CSS width">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="75%"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="200px"></tc-placeholder>
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" size="lg"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" size="sm"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" size="xs"></tc-placeholder>
                            </div>
                        </SectionCard>

                        <SectionCard title="Glow animation">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="8" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="4" animation="glow"></tc-placeholder>
                            </div>
                        </SectionCard>

                        <SectionCard title="Wave animation">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" animation="wave"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="8" animation="wave"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="4" animation="wave"></tc-placeholder>
                            </div>
                        </SectionCard>

                        <SectionCard title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" variant="primary" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" variant="secondary" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" variant="success" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" variant="danger" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" variant="warning" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" variant="info" animation="glow"></tc-placeholder>
                            </div>
                        </SectionCard>

                        <SectionCard title="Multiple lines (slotted children)">
                            {/* @ts-ignore */}
                            <tc-placeholder animation="glow">
                                <span className="placeholder col-12"></span>
                                <span className="placeholder col-8"></span>
                                <span className="placeholder col-4 bg-secondary"></span>
                                {/* @ts-ignore */}
                            </tc-placeholder>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default PlaceholderDemo
