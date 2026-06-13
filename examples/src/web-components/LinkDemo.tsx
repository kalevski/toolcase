import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LinkDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Link"
                        description="Semantic anchor with variant colors, underline modes, and an optional external-link icon. Renders a real &lt;a&gt; for correct semantics."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="primary">Primary</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="secondary">Secondary</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="info">Info</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="success">Success</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="warning">Warning</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="danger">Danger</tc-link>
                            </div>
                        </SectionCard>

                        <SectionCard title="Underline modes">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-link href="#" underline="always">Always underlined</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" underline="hover">Underline on hover (default)</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="#" underline="none">Never underlined</tc-link>
                            </div>
                        </SectionCard>

                        <SectionCard title="External link">
                            <div className="d-flex flex-wrap gap-3">
                                {/* @ts-ignore */}
                                <tc-link href="https://example.com" external>Open in new tab</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="https://example.com" variant="info" external>External info link</tc-link>
                                {/* @ts-ignore */}
                                <tc-link href="https://example.com" variant="success" external underline="always">External always underlined</tc-link>
                            </div>
                        </SectionCard>

                        <SectionCard title="Inline within text">
                            <p>
                                This paragraph contains an{' '}
                                {/* @ts-ignore */}
                                <tc-link href="#" variant="primary">inline link</tc-link>
                                {' '}that flows naturally within prose, plus a{' '}
                                {/* @ts-ignore */}
                                <tc-link href="https://example.com" variant="danger" external>danger external link</tc-link>
                                {' '}to demonstrate mixed use.
                            </p>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default LinkDemo
