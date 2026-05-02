import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const Cell = ({ label }: { label: string }) => (
    <div style={{
        padding: '8px',
        background: 'linear-gradient(180deg, #2e2418 0%, #1a130c 70%)',
        border: '1px solid var(--fg-gold-deep, #8b6f3a)',
        color: 'var(--fg-parch, #e8dcc4)',
        fontFamily: 'var(--fg-mono, monospace)',
        fontSize: '11px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase' as const,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12)',
        textAlign: 'center' as const,
    }}>
        {label}
    </div>
)

const GridDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Grid"
                    description="Layout primitive. CSS grid container with columns, rows, gap, and cellSize props."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="3 columns — fixed cell size">
                        {/* @ts-ignore */}
                        <gc-grid columns="3" cell-size="80px" gap="6px">
                            {['A', 'B', 'C', 'D', 'E', 'F'].map(l => <Cell key={l} label={l} />)}
                            {/* @ts-ignore */}
                        </gc-grid>
                    </SectionCard>

                    <SectionCard title="4 columns — 1fr (fluid)">
                        {/* @ts-ignore */}
                        <gc-grid columns="4" gap="8px">
                            {['Sword', 'Shield', 'Helm', 'Boots', 'Gloves', 'Cloak', 'Ring', 'Amulet'].map(l => <Cell key={l} label={l} />)}
                            {/* @ts-ignore */}
                        </gc-grid>
                    </SectionCard>

                    <SectionCard title="3×3 grid — fixed cell size">
                        {/* @ts-ignore */}
                        <gc-grid columns="3" rows="3" cell-size="64px" gap="4px">
                            {Array.from({ length: 9 }, (_, i) => <Cell key={i} label={String(i + 1)} />)}
                            {/* @ts-ignore */}
                        </gc-grid>
                    </SectionCard>

                    <SectionCard title="2 columns — 12px gap">
                        {/* @ts-ignore */}
                        <gc-grid columns="2" gap="12px">
                            {['Alpha', 'Beta', 'Gamma', 'Delta'].map(l => <Cell key={l} label={l} />)}
                            {/* @ts-ignore */}
                        </gc-grid>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default GridDemo
