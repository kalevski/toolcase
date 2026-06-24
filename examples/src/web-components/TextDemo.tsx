import React from 'react'

const TextDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Text"
                        description="Flexible text element with semantic HTML tags and style variants. Supports default, muted, code, mono, and truncate treatments across three sizes."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text variant="default">
                                    Default — slate prose text (Inter)
                                </tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="muted">
                                    Muted — secondary/muted text color
                                </tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="mono">
                                    Mono — JetBrains Mono in normal text color
                                </tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="code">
                                    code — inline code chip on muted surface
                                </tc-text>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Truncate variant (narrow box)">
                            <div
                                style={{
                                    width: '220px',
                                    border: '1px dashed #cbd5e1',
                                    padding: '8px',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-text variant="truncate" as="div">
                                    This text is intentionally very long and will be truncated with
                                    an ellipsis when it overflows its container.
                                </tc-text>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text size="small">Small — ~12.5–13px (0.8rem)</tc-text>
                                {/* @ts-ignore */}
                                <tc-text size="default">Default — 0.925rem</tc-text>
                                {/* @ts-ignore */}
                                <tc-text size="large">Large — 1.0625rem</tc-text>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="as attribute (semantic tag)">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text as="p">Paragraph (as=&quot;p&quot;, default)</tc-text>
                                {/* @ts-ignore */}
                                <span>
                                    Inline: <tc-text as="span">span text</tc-text> inside a
                                    sentence.
                                </span>
                                {/* @ts-ignore */}
                                <span>
                                    Small: <tc-text as="small">small text</tc-text> inline.
                                </span>
                                {/* @ts-ignore */}
                                <tc-text as="div">Div block (as=&quot;div&quot;)</tc-text>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Slotted inline markup">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-text>
                                    Text with <strong>bold</strong> and <em>italic</em> children.
                                </tc-text>
                                {/* @ts-ignore */}
                                <tc-text variant="muted" size="small">
                                    Small muted note with a <a href="#">link</a> inside.
                                </tc-text>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TextDemo
