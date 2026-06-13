import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SkeletonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Skeleton"
                        description="Loading-state placeholder with customizable shape and dimensions. Three variants: text (stacked lines), circle (equal width/height), and rect (sharp block)."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Text — single line">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="text"></tc-skeleton>
                            </div>
                        </SectionCard>

                        <SectionCard title="Text — multiple lines (count)">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="text" count="4"></tc-skeleton>
                            </div>
                        </SectionCard>

                        <SectionCard title="Circle (with width / height)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-skeleton variant="circle" width="40" height="40"></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="circle" width="64" height="64"></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="circle" width="96" height="96"></tc-skeleton>
                            </div>
                        </SectionCard>

                        <SectionCard title="Rect">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="rect" width="100%" height="120"></tc-skeleton>
                            </div>
                        </SectionCard>

                        <SectionCard title="Card skeleton (composed)">
                            <div style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="rect" width="100%" height="160"></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="text" count="3"></tc-skeleton>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SkeletonDemo
