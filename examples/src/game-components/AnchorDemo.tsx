import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const Chip = ({ label }: { label: string }) => (
    <div style={{
        padding: '6px 10px',
        background: 'linear-gradient(180deg, #2e2418 0%, #1a130c 70%)',
        border: '1px solid var(--fg-gold-deep, #8b6f3a)',
        color: 'var(--fg-gold-bright, #f0d27a)',
        fontFamily: 'var(--fg-display, serif)',
        fontSize: '10px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase' as const,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12)',
        whiteSpace: 'nowrap' as const,
    }}>
        {label}
    </div>
)

const Arena = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
        <div style={{
            fontFamily: 'var(--fg-mono, monospace)',
            fontSize: '10px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase' as const,
            color: 'var(--fg-parch-dim, #8b7a5e)',
            marginBottom: '6px',
        }}>
            {title}
        </div>
        <div style={{
            position: 'relative',
            width: '280px',
            height: '180px',
            background: 'radial-gradient(120% 80% at 50% 0%, #2e2418 0%, #1a130c 70%)',
            border: '1px solid var(--fg-gold-deep, #8b6f3a)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12)',
        }}>
            {children}
        </div>
    </div>
)

const AnchorDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Anchor"
                    description="Layout primitive. Positions child absolutely within a relative parent using position and inset props."
                />
                <div className="d-flex flex-wrap gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Corner positions" />
                        <div className="d-flex flex-wrap gap-4">
                            <Arena title="top-left">
                                {/* @ts-ignore */}
                                <gc-anchor position="top-left" inset="8px">
                                    <Chip label="top-left" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="top-right">
                                {/* @ts-ignore */}
                                <gc-anchor position="top-right" inset="8px">
                                    <Chip label="top-right" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="bottom-left">
                                {/* @ts-ignore */}
                                <gc-anchor position="bottom-left" inset="8px">
                                    <Chip label="bottom-left" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="bottom-right">
                                {/* @ts-ignore */}
                                <gc-anchor position="bottom-right" inset="8px">
                                    <Chip label="bottom-right" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Edge centers + center" />
                        <div className="d-flex flex-wrap gap-4">
                            <Arena title="top">
                                {/* @ts-ignore */}
                                <gc-anchor position="top" inset="8px">
                                    <Chip label="top" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="left">
                                {/* @ts-ignore */}
                                <gc-anchor position="left" inset="8px">
                                    <Chip label="left" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="right">
                                {/* @ts-ignore */}
                                <gc-anchor position="right" inset="8px">
                                    <Chip label="right" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="bottom">
                                {/* @ts-ignore */}
                                <gc-anchor position="bottom" inset="8px">
                                    <Chip label="bottom" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                            <Arena title="center">
                                {/* @ts-ignore */}
                                <gc-anchor position="center">
                                    <Chip label="center" />
                                    {/* @ts-ignore */}
                                </gc-anchor>
                            </Arena>
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="All 9 positions — inset 12px" />
                        <div style={{ position: 'relative', width: '320px', height: '220px', background: 'radial-gradient(120% 80% at 50% 0%, #2e2418 0%, #1a130c 70%)', border: '1px solid var(--fg-gold-deep, #8b6f3a)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6)' }}>
                            {(['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const).map(pos => (
                                <React.Fragment key={pos}>
                                    {/* @ts-ignore */}
                                    <gc-anchor position={pos} inset="12px">
                                        <Chip label={pos} />
                                        {/* @ts-ignore */}
                                    </gc-anchor>
                                </React.Fragment>
                            ))}
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default AnchorDemo
