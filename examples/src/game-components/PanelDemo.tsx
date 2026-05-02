import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const Body = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        fontFamily: 'var(--fg-body, serif)',
        fontSize: '14px',
        lineHeight: 1.5,
    }}>
        {children}
    </div>
)

const Title = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        fontFamily: 'var(--fg-display, serif)',
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase' as const,
        color: 'var(--fg-gold-bright, #f0d27a)',
        fontSize: '14px',
        marginBottom: '8px',
    }}>
        {children}
    </div>
)

const PanelDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Panel"
                    description="Gilded square frame surface. Props: bordered, corners, parchment."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Plain (no props)" />
                        {/* @ts-ignore */}
                        <gc-panel>
                            <Body>Bare container. No frame, no corners.</Body>
                            {/* @ts-ignore */}
                        </gc-panel>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Bordered" />
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            <Title>Bordered Panel</Title>
                            <Body>Gilded bronze border with inset bevel stack and dark wood gradient.</Body>
                            {/* @ts-ignore */}
                        </gc-panel>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Bordered + Corners (signature)" />
                        {/* @ts-ignore */}
                        <gc-panel bordered corners>
                            <Title>Gilded Frame</Title>
                            <Body>Top corner notches add the canonical fantasy panel signature.</Body>
                            {/* @ts-ignore */}
                        </gc-panel>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Parchment" />
                        {/* @ts-ignore */}
                        <gc-panel parchment>
                            <Body>Parchment surface variant. Used for menu bodies and codex pages.</Body>
                            {/* @ts-ignore */}
                        </gc-panel>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Parchment + Bordered + Corners" />
                        {/* @ts-ignore */}
                        <gc-panel parchment bordered corners>
                            <Title>Codex Page</Title>
                            <Body>Parchment surface with gilded border and corner notches.</Body>
                            {/* @ts-ignore */}
                        </gc-panel>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default PanelDemo
