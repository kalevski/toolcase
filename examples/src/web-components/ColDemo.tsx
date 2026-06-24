import React from 'react'

const Box = ({ label }: { label: string }) => (
    <div
        style={{
            padding: '12px 16px',
            background: 'var(--tc-surface-muted, #f1f5f9)',
            border: '1px solid var(--tc-border, #e2e8f0)',
            color: 'var(--tc-text, #1e293b)',
            fontFamily: 'var(--tc-font-family-mono, monospace)',
            fontSize: '12px',
            textAlign: 'center',
        }}
    >
        {label}
    </div>
)

const ColDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Col"
                        description="Bootstrap grid column wrapper. Maps span, span-{bp}, offset-{bp}, order, and order-{bp} attributes to Bootstrap col-* utility classes."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Bare tc-col — .col (auto width)">
                            {/* @ts-ignore */}
                            <tc-row>
                                {/* @ts-ignore */}
                                <tc-col>
                                    <Box label="col" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col>
                                    <Box label="col" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col>
                                    <Box label="col" />
                                </tc-col>
                                {/* @ts-ignore */}
                            </tc-row>
                        </tc-section-card>

                        <tc-section-card title='span="6" — .col-6 (half width)'>
                            {/* @ts-ignore */}
                            <tc-row>
                                {/* @ts-ignore */}
                                <tc-col span="6">
                                    <Box label="col-6" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col span="6">
                                    <Box label="col-6" />
                                </tc-col>
                                {/* @ts-ignore */}
                            </tc-row>
                        </tc-section-card>

                        <tc-section-card title='span="12" span-md="4" — responsive span per breakpoint'>
                            {/* @ts-ignore */}
                            <tc-row>
                                {/* @ts-ignore */}
                                <tc-col span="12" span-md="4">
                                    <Box label="12 → md:4" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col span="12" span-md="4">
                                    <Box label="12 → md:4" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col span="12" span-md="4">
                                    <Box label="12 → md:4" />
                                </tc-col>
                                {/* @ts-ignore */}
                            </tc-row>
                        </tc-section-card>

                        <tc-section-card title='span="auto" — .col-auto (content width)'>
                            {/* @ts-ignore */}
                            <tc-row>
                                {/* @ts-ignore */}
                                <tc-col span="auto">
                                    <Box label="auto" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col>
                                    <Box label="col (fills)" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col span="auto">
                                    <Box label="auto" />
                                </tc-col>
                                {/* @ts-ignore */}
                            </tc-row>
                        </tc-section-card>

                        <tc-section-card title='offset-md="2" — .offset-md-2'>
                            {/* @ts-ignore */}
                            <tc-row>
                                {/* @ts-ignore */}
                                <tc-col span="4" offset-md="2">
                                    <Box label="col-4 offset-md-2" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col span="4">
                                    <Box label="col-4" />
                                </tc-col>
                                {/* @ts-ignore */}
                            </tc-row>
                        </tc-section-card>

                        <tc-section-card title='order="last" / order="first" — reordering'>
                            {/* @ts-ignore */}
                            <tc-row>
                                {/* @ts-ignore */}
                                <tc-col order="last">
                                    <Box label="order-last (first in DOM)" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col>
                                    <Box label="col (middle)" />
                                </tc-col>
                                {/* @ts-ignore */}
                                <tc-col order="first">
                                    <Box label="order-first (last in DOM)" />
                                </tc-col>
                                {/* @ts-ignore */}
                            </tc-row>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ColDemo
