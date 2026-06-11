import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const Box = ({ label }: { label: string }) => (
    <div style={{
        padding: '12px 16px',
        background: 'var(--tc-surface-muted, #f1f5f9)',
        border: '1px solid var(--tc-border, #e2e8f0)',
        color: 'var(--tc-text, #1e293b)',
        fontFamily: 'var(--tc-font-family-mono, monospace)',
        fontSize: '12px',
    }}>
        {label}
    </div>
)

const ContainerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Container"
                        description="Responsive layout wrapper. Maps to Bootstrap's container, container-fluid, or container-{bp} classes via the fluid and breakpoint attributes."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default — .container (fixed-width responsive)">
                            {/* @ts-ignore */}
                            <tc-container>
                                <Box label="Default container — max-width steps at each breakpoint" />
                            {/* @ts-ignore */}
                            </tc-container>
                        </SectionCard>

                        <SectionCard title="fluid — .container-fluid (full-width)">
                            {/* @ts-ignore */}
                            <tc-container fluid>
                                <Box label="container-fluid — 100% width at all breakpoints" />
                            {/* @ts-ignore */}
                            </tc-container>
                        </SectionCard>

                        <SectionCard title="breakpoint variants">
                            <div className="d-flex flex-column gap-2">
                                {(['sm', 'md', 'lg', 'xl', 'xxl'] as const).map(bp => (
                                    <React.Fragment key={bp}>
                                        {/* @ts-ignore */}
                                        <tc-container breakpoint={bp}>
                                            <Box label={`container-${bp} — fluid below ${bp}, fixed-width above`} />
                                        {/* @ts-ignore */}
                                        </tc-container>
                                    </React.Fragment>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ContainerDemo
