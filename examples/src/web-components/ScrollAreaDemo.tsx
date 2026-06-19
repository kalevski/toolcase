import React from 'react'

const paragraphStyle: React.CSSProperties = {
    margin: '0 0 0.75rem',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'var(--tc-text, #1e293b)',
}

const rows = Array.from({ length: 20 }, (_, i) => i + 1)

const ScrollAreaDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Scroll Area"
                            description="A scrollable container with configurable max dimensions and scroll axis. A thin slate scrollbar keeps the chrome quiet; the region becomes keyboard-scrollable only when its content overflows."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Vertical (axis=y)">
                                <div style={{ border: '1px solid var(--tc-border, #e2e8f0)' }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-area axis="y" max-height="220">
                                        <div style={{ padding: '1rem' }}>
                                            {rows.map((n) => (
                                                <p key={n} style={paragraphStyle}>
                                                    <strong>Row {n}.</strong> The default axis is
                                                    vertical: overflow-y is auto and overflow-x is
                                                    hidden. Scroll down to reveal the remaining
                                                    rows.
                                                </p>
                                            ))}
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-scroll-area>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Horizontal (axis=x)">
                                <div style={{ border: '1px solid var(--tc-border, #e2e8f0)' }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-area axis="x" max-width="100%">
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: '0.75rem',
                                                padding: '1rem',
                                                width: 'max-content',
                                            }}
                                        >
                                            {rows.map((n) => (
                                                <div
                                                    key={n}
                                                    style={{
                                                        flex: '0 0 auto',
                                                        width: 160,
                                                        padding: '1rem',
                                                        background:
                                                            'var(--tc-surface-hover, #f8fafc)',
                                                        fontSize: '0.875rem',
                                                        color: 'var(--tc-text, #1e293b)',
                                                    }}
                                                >
                                                    <strong>Card {n}</strong>
                                                    <p className="mb-0 mt-2">
                                                        Scrolls horizontally only.
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-scroll-area>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Both axes (axis=both)">
                                <div style={{ border: '1px solid var(--tc-border, #e2e8f0)' }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-area axis="both" max-height="220" max-width="100%">
                                        <div style={{ width: 900, padding: '1rem' }}>
                                            {rows.map((n) => (
                                                <p
                                                    key={n}
                                                    style={{
                                                        ...paragraphStyle,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    <strong>Line {n}.</strong> This content is wider
                                                    than the container and taller than the
                                                    max-height, so both scrollbars appear when axis
                                                    is "both".
                                                </p>
                                            ))}
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-scroll-area>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScrollAreaDemo
