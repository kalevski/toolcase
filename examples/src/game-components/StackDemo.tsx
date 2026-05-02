import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const Box = ({ label }: { label: string }) => (
    <div style={{
        padding: '8px 14px',
        background: 'linear-gradient(180deg, #2e2418 0%, #1a130c 70%)',
        border: '1px solid var(--fg-gold-deep, #8b6f3a)',
        color: 'var(--fg-parch, #e8dcc4)',
        fontFamily: 'var(--fg-display, serif)',
        fontSize: '11px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase' as const,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12)',
        minWidth: '60px',
        textAlign: 'center' as const,
    }}>
        {label}
    </div>
)

const StackDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Stack"
                    description="Layout primitive. Flex container with direction, gap, align, justify, wrap, and inline props."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Vertical (default)" />
                        {/* @ts-ignore */}
                        <gc-stack gap="8px">
                            <Box label="Item A" />
                            <Box label="Item B" />
                            <Box label="Item C" />
                            {/* @ts-ignore */}
                        </gc-stack>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Horizontal" />
                        {/* @ts-ignore */}
                        <gc-stack direction="horizontal" gap="8px">
                            <Box label="Item A" />
                            <Box label="Item B" />
                            <Box label="Item C" />
                            {/* @ts-ignore */}
                        </gc-stack>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Horizontal — center aligned" />
                        {/* @ts-ignore */}
                        <gc-stack direction="horizontal" gap="12px" align="center">
                            <Box label="Short" />
                            <div style={{ height: '56px', padding: '8px 14px', background: 'linear-gradient(180deg, #2e2418 0%, #1a130c 70%)', border: '1px solid var(--fg-gold-deep, #8b6f3a)', color: 'var(--fg-parch, #e8dcc4)', fontFamily: 'var(--fg-display, serif)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12)' }}>Tall</div>
                            <Box label="Short" />
                            {/* @ts-ignore */}
                        </gc-stack>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Horizontal — space-between justified" />
                        {/* @ts-ignore */}
                        <gc-stack direction="horizontal" gap="8px" justify="space-between" style={{ width: '100%' }}>
                            <Box label="Left" />
                            <Box label="Middle" />
                            <Box label="Right" />
                            {/* @ts-ignore */}
                        </gc-stack>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Wrap" />
                        {/* @ts-ignore */}
                        <gc-stack direction="horizontal" gap="6px" wrap style={{ maxWidth: '260px' }}>
                            {['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'].map(label => (
                                <Box key={label} label={label} />
                            ))}
                            {/* @ts-ignore */}
                        </gc-stack>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Inline" />
                        <span style={{ color: 'var(--fg-parch-3, #b8a47e)', fontFamily: 'var(--fg-body, serif)', fontSize: '14px' }}>
                            Inline stack:{' '}
                        </span>
                        {/* @ts-ignore */}
                        <gc-stack inline direction="horizontal" gap="6px" align="center">
                            <Box label="A" />
                            <Box label="B" />
                            {/* @ts-ignore */}
                        </gc-stack>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default StackDemo
