import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ProgressDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Progress"
                        description="Bootstrap progress bars wrapped as custom elements. Supports single bars with variants, striped and animated patterns, and stacked bars."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Plain">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="0" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="25" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="50" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="75" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="100" label></tc-progress>
                            </div>
                        </SectionCard>

                        <SectionCard title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="primary"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="success"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="danger"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="warning"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="info"></tc-progress>
                            </div>
                        </SectionCard>

                        <SectionCard title="Striped">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="40" variant="primary" striped></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="success" striped></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="80" variant="danger" striped></tc-progress>
                            </div>
                        </SectionCard>

                        <SectionCard title="Animated">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="40" variant="primary" striped animated></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="success" striped animated></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="80" variant="danger" striped animated></tc-progress>
                            </div>
                        </SectionCard>

                        <SectionCard title="Stacked">
                            {/* @ts-ignore */}
                            <tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress-bar value="15" variant="primary"></tc-progress-bar>
                                {/* @ts-ignore */}
                                <tc-progress-bar value="30" variant="success" striped></tc-progress-bar>
                                {/* @ts-ignore */}
                                <tc-progress-bar value="20" variant="danger" striped animated></tc-progress-bar>
                                {/* @ts-ignore */}
                            </tc-progress>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ProgressDemo
