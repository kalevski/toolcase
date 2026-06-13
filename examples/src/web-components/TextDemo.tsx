import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TextDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Text"
                        description="Flexible text element with semantic HTML tags and style variants. Supports default, muted, code, mono, and truncate treatments across three sizes."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text variant="default">Default — slate prose text (Inter)</tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="muted">Muted — secondary/muted text color</tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="mono">Mono — JetBrains Mono in normal text color</tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="code">code — inline code chip on muted surface</tc-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="Truncate variant (narrow box)">
                            <div style={{ width: '220px', border: '1px dashed #cbd5e1', padding: '8px' }}>
                                {/* @ts-ignore */}
                                <tc-text variant="truncate" as="div">This text is intentionally very long and will be truncated with an ellipsis when it overflows its container.</tc-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text size="small">Small — ~12.5–13px (0.8rem)</tc-text>
                                {/* @ts-ignore */}
                                <tc-text size="default">Default — 0.925rem</tc-text>
                                {/* @ts-ignore */}
                                <tc-text size="large">Large — 1.0625rem</tc-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="as attribute (semantic tag)">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text as="p">Paragraph (as=&quot;p&quot;, default)</tc-text>
                                {/* @ts-ignore */}
                                <span>Inline: <tc-text as="span">span text</tc-text> inside a sentence.</span>
                                {/* @ts-ignore */}
                                <span>Small: <tc-text as="small">small text</tc-text> inline.</span>
                                {/* @ts-ignore */}
                                <tc-text as="div">Div block (as=&quot;div&quot;)</tc-text>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted inline markup">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text>Text with <strong>bold</strong> and <em>italic</em> children.</tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="muted" size="small">Small muted note with a <a href="#">link</a> inside.</tc-text>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TextDemo
