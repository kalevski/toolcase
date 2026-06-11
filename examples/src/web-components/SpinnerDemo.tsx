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
                        description="Loading indicators wrapping Bootstrap's border and grow spinner classes. Supports all theme variants and a small size."
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
