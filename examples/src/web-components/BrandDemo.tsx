import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BrandDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Brand"
                        description="Branded wordmark with primary/secondary text, an optional micro-label chip, and a customisable accent underline bar."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Primary text (attribute)">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase"></tc-brand>
                            </div>
                        </SectionCard>

                        <SectionCard title="Primary + secondary text">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="Tool" secondary-text="Case"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand primary-text="Toolcase" secondary-text="Platform"></tc-brand>
                            </div>
                        </SectionCard>

                        <SectionCard title="With label badge">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" label="beta"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand primary-text="Tool" secondary-text="Case" label="v2"></tc-brand>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom underline color">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" color="#e85d04"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" color="#7209b7"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" color="oklch(0.7 0.2 145)"></tc-brand>
                            </div>
                        </SectionCard>

                        <SectionCard title="Xlarge scale">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" xlarge></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand primary-text="Tool" secondary-text="Case" label="pro" xlarge></tc-brand>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted content">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand>
                                    <strong slot="primary">ToolCase</strong>
                                </tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand>
                                    <strong slot="primary">Tool</strong>
                                    <span slot="secondary">Case</span>
                                    <em slot="label">alpha</em>
                                </tc-brand>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BrandDemo
