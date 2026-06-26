import React from 'react'

const cellStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    minHeight: '48px',
    border: '1px solid var(--tc-border)',
    background: 'var(--tc-surface-muted)',
    fontFamily: 'var(--tc-font-mono, monospace)',
    fontSize: '12.5px',
    color: 'var(--tc-text)',
}

const Cell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={cellStyle}>{children}</div>
)

const GridDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Grid"
                        description="CSS-grid layout primitive — set a column and/or row count, a gap, and a uniform cell size. Children are laid out directly; the element owns no chrome of its own."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Three equal columns (gap 8px)">
                            {/* @ts-ignore */}
                            <tc-grid columns="3" gap="8">
                                <Cell>1</Cell>
                                <Cell>2</Cell>
                                <Cell>3</Cell>
                                <Cell>4</Cell>
                                <Cell>5</Cell>
                                <Cell>6</Cell>
                                {/* @ts-ignore */}
                            </tc-grid>
                        </tc-section-card>

                        <tc-section-card title="Responsive — 1 col on mobile → 2 (sm) → 3 (md) → 6 (lg). Resize the window.">
                            {/* @ts-ignore */}
                            <tc-grid
                                columns="1"
                                columns-sm="2"
                                columns-md="3"
                                columns-lg="6"
                                gap="6"
                                gap-md="12"
                            >
                                <Cell>1</Cell>
                                <Cell>2</Cell>
                                <Cell>3</Cell>
                                <Cell>4</Cell>
                                <Cell>5</Cell>
                                <Cell>6</Cell>
                                {/* @ts-ignore */}
                            </tc-grid>
                        </tc-section-card>

                        <tc-section-card title="Fixed cell size (4 columns × 64px, gap 1rem)">
                            {/* @ts-ignore */}
                            <tc-grid columns="4" cell-size="64px" gap="1rem">
                                <Cell>A</Cell>
                                <Cell>B</Cell>
                                <Cell>C</Cell>
                                <Cell>D</Cell>
                                {/* @ts-ignore */}
                            </tc-grid>
                        </tc-section-card>

                        <tc-section-card title="Hairline grid (gap 1px over a slate background)">
                            <div
                                style={{
                                    background: 'var(--tc-border)',
                                    border: '1px solid var(--tc-border)',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-grid columns="3" gap="1">
                                    <div
                                        style={{
                                            ...cellStyle,
                                            border: 'none',
                                            background: 'var(--tc-surface)',
                                        }}
                                    >
                                        cpu
                                    </div>
                                    <div
                                        style={{
                                            ...cellStyle,
                                            border: 'none',
                                            background: 'var(--tc-surface)',
                                        }}
                                    >
                                        mem
                                    </div>
                                    <div
                                        style={{
                                            ...cellStyle,
                                            border: 'none',
                                            background: 'var(--tc-surface)',
                                        }}
                                    >
                                        disk
                                    </div>
                                    <div
                                        style={{
                                            ...cellStyle,
                                            border: 'none',
                                            background: 'var(--tc-surface)',
                                        }}
                                    >
                                        net
                                    </div>
                                    <div
                                        style={{
                                            ...cellStyle,
                                            border: 'none',
                                            background: 'var(--tc-surface)',
                                        }}
                                    >
                                        gpu
                                    </div>
                                    <div
                                        style={{
                                            ...cellStyle,
                                            border: 'none',
                                            background: 'var(--tc-surface)',
                                        }}
                                    >
                                        io
                                    </div>
                                    {/* @ts-ignore */}
                                </tc-grid>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Explicit rows and columns (2 × 3, square cells)">
                            {/* @ts-ignore */}
                            <tc-grid columns="3" rows="2" cell-size="56" gap="6">
                                <Cell>R1C1</Cell>
                                <Cell>R1C2</Cell>
                                <Cell>R1C3</Cell>
                                <Cell>R2C1</Cell>
                                <Cell>R2C2</Cell>
                                <Cell>R2C3</Cell>
                                {/* @ts-ignore */}
                            </tc-grid>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default GridDemo
