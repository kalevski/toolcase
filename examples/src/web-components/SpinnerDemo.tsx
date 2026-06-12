import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SpinnerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Spinner"
                        description="Loading indicators in six shapes — border ring, grow pulse-dot, bouncing dots, equalizer bars, sonar pulse and dashed orbit. Supports all theme variants and a small size."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Border (default)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="border"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Grow">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="grow"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Variants — border">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="secondary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="success"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="danger"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="warning"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="info"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="light"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="dark"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Variants — grow">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="secondary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="success"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="danger"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="warning"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="info"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="light"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="dark"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Dots">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="dots"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="dots" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="dots" variant="danger"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="dots" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Bars">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="bars"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="bars" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="bars" variant="success"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="bars" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Pulse">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse" variant="warning"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Orbit">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit" variant="info"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Small">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner size="sm" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom label">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner variant="primary" label="Please wait…"></tc-spinner>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SpinnerDemo
