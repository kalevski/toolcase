import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const Col = ({ label }: { label: string }) => (
    <div style={{
        padding: '12px 16px',
        background: 'var(--tc-surface-muted, #f1f5f9)',
        border: '1px solid var(--tc-border, #e2e8f0)',
        color: 'var(--tc-text, #1e293b)',
        fontFamily: 'var(--tc-font-family-mono, monospace)',
        fontSize: '12px',
        textAlign: 'center',
    }}>
        {label}
    </div>
)

const RowDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Row"
                        description="Bootstrap grid row wrapper. Maps cols, cols-{bp}, gutter/g, align, and justify attributes to Bootstrap row-cols-* and utility classes."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default — .row">
                            {/* @ts-ignore */}
                            <tc-row>
                                <div className="col"><Col label="col 1" /></div>
                                <div className="col"><Col label="col 2" /></div>
                                <div className="col"><Col label="col 3" /></div>
                            {/* @ts-ignore */}
                            </tc-row>
                        </SectionCard>

                        <SectionCard title='cols="2" — .row.row-cols-2'>
                            {/* @ts-ignore */}
                            <tc-row cols="2">
                                {[1, 2, 3, 4].map(n => (
                                    <div key={n} className="col"><Col label={`col ${n}`} /></div>
                                ))}
                            {/* @ts-ignore */}
                            </tc-row>
                        </SectionCard>

                        <SectionCard title='cols="1" cols-md="3" — responsive cols per breakpoint'>
                            {/* @ts-ignore */}
                            <tc-row cols="1" cols-md="3">
                                {[1, 2, 3].map(n => (
                                    <div key={n} className="col"><Col label={`col ${n}`} /></div>
                                ))}
                            {/* @ts-ignore */}
                            </tc-row>
                        </SectionCard>

                        <SectionCard title='gutter="3" — .g-3'>
                            {/* @ts-ignore */}
                            <tc-row cols="3" gutter="3">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <div key={n} className="col"><Col label={`col ${n}`} /></div>
                                ))}
                            {/* @ts-ignore */}
                            </tc-row>
                        </SectionCard>

                        <SectionCard title='gutter="x2 y4" — axis-specific gutters (.gx-2.gy-4)'>
                            {/* @ts-ignore */}
                            <tc-row cols="3" gutter="x2 y4">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <div key={n} className="col"><Col label={`col ${n}`} /></div>
                                ))}
                            {/* @ts-ignore */}
                            </tc-row>
                        </SectionCard>

                        <SectionCard title='align="center" justify="between"'>
                            {/* @ts-ignore */}
                            <tc-row align="center" justify="between" style={{ minHeight: '80px' }}>
                                <div className="col-3"><Col label="col A" /></div>
                                <div className="col-3"><Col label="col B" /></div>
                            {/* @ts-ignore */}
                            </tc-row>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RowDemo
