import React from 'react'

const box = (label: string) => (
    <div
        style={{
            padding: '8px 12px',
            background: 'var(--tc-surface-muted)',
            border: '1px solid var(--tc-border)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--tc-font-mono)',
        }}
    >
        {label}
    </div>
)

const StackDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Stack"
                        description="Flexbox row/column layout primitive. Composes children along a single axis with configurable gap, alignment, and wrapping."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Vertical stack (default)">
                            {/* @ts-ignore */}
                            <tc-stack gap="8px">
                                {box('Item A')}
                                {box('Item B')}
                                {box('Item C')}
                                {/* @ts-ignore */}
                            </tc-stack>
                        </tc-section-card>

                        <tc-section-card title="Horizontal stack with gap">
                            {/* @ts-ignore */}
                            <tc-stack direction="horizontal" gap="12px" align="center">
                                {box('Left')}
                                {box('Middle')}
                                {box('Right')}
                                {/* @ts-ignore */}
                            </tc-stack>
                        </tc-section-card>

                        <tc-section-card title="Wrapping horizontal stack">
                            {/* @ts-ignore */}
                            <tc-stack direction="horizontal" gap="8px" wrap>
                                {box('Alpha')}
                                {box('Beta')}
                                {box('Gamma')}
                                {box('Delta')}
                                {box('Epsilon')}
                                {box('Zeta')}
                                {box('Eta')}
                                {box('Theta')}
                                {/* @ts-ignore */}
                            </tc-stack>
                        </tc-section-card>

                        <tc-section-card title="Space-between justify">
                            {/* @ts-ignore */}
                            <tc-stack direction="horizontal" justify="space-between" align="center">
                                {box('Start')}
                                {box('Center')}
                                {box('End')}
                                {/* @ts-ignore */}
                            </tc-stack>
                        </tc-section-card>

                        <tc-section-card title="Inline stack (inline-flex)">
                            <p style={{ marginBottom: '8px', fontSize: '0.8125rem' }}>
                                Inline text before
                                {/* @ts-ignore */}
                                <tc-stack inline direction="horizontal" gap="4px" align="center">
                                    {box('A')}
                                    {box('B')}
                                    {/* @ts-ignore */}
                                </tc-stack>
                                and after.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StackDemo
