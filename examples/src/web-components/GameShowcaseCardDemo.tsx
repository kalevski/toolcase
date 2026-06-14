import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const GameShowcaseCardDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const clickableRef = useRef<any>(null)

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.tags = ['RPG', 'Fantasy', 'Multiplayer']
        basicRef.current.compliance = [
            { label: 'PEGI 12', state: 'pass' },
            { label: 'ESRB T', state: 'pass' },
        ]
    }, [])

    useEffect(() => {
        if (!fullRef.current) return
        fullRef.current.stamps = [
            { label: 'New', tone: 'success' },
            { label: 'Featured', icon: 'star' },
        ]
        fullRef.current.tags = ['Action', 'Open World', 'Co-op', 'Early Access']
        fullRef.current.compliance = [
            { label: 'PEGI 18', state: 'fail' },
            { label: 'ESRB M', state: 'warn' },
            { label: 'Accessibility', state: 'pass' },
        ]
    }, [])

    useEffect(() => {
        if (!clickableRef.current) return
        clickableRef.current.tags = ['Puzzle', 'Indie']
        clickableRef.current.compliance = [
            { label: 'PEGI 3', state: 'pass' },
        ]
        clickableRef.current.onClick = () => {
            console.log('[GameShowcaseCard] onClick callback fired')
        }
        clickableRef.current.addEventListener('tc-click', (e: CustomEvent) => {
            console.log('[GameShowcaseCard] tc-click event', e.detail)
        })
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="GameShowcaseCard"
                            description="Game showcase card with artwork, title, pitch, tags, compliance indicators, and corner stamps. Set stamps/tags/compliance via JS properties; art/meta/title/pitch via slots or attributes."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic (title + pitch attributes, tags + compliance via JS property)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-game-showcase-card
                                        ref={basicRef}
                                        title="Dragon Realm"
                                        pitch="An epic fantasy RPG set in a world of ancient dragons and forgotten kingdoms."
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="With artwork (slotted image)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-game-showcase-card
                                        title="Neon Streets"
                                        pitch="A cyberpunk city builder with real-time traffic simulation."
                                    >
                                        <div
                                            slot="art"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--tc-accent)',
                                                fontFamily: 'JetBrains Mono, monospace',
                                                fontSize: '0.875rem',
                                                letterSpacing: '0.1em',
                                            }}
                                        >
                                            NEON STREETS
                                        </div>
                                        <span slot="meta-left">v2.1.0</span>
                                        <span slot="meta-right">Studio X</span>
                                        {/* @ts-ignore */}
                                    </tc-game-showcase-card>
                                </div>
                            </SectionCard>

                            <SectionCard title="With art placeholder (shown when no art slot provided)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-game-showcase-card
                                        title="Ghost Protocol"
                                        pitch="Stealth action game with emergent AI behavior."
                                    >
                                        <div
                                            slot="art-placeholder"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--tc-text-faint)',
                                                fontSize: '2rem',
                                            }}
                                        >
                                            🎮
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-game-showcase-card>
                                </div>
                            </SectionCard>

                            <SectionCard title="Full-featured (stamps + tags + compliance + meta slots)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-game-showcase-card
                                        ref={fullRef}
                                        title="Horizon Breach"
                                        pitch="Massive open-world action RPG with procedurally generated quests and co-op multiplayer."
                                    >
                                        <div
                                            slot="art"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'linear-gradient(160deg, #2d1b69 0%, #11998e 100%)',
                                            }}
                                        />
                                        <span slot="meta-left">v0.8.4 EA</span>
                                        <span slot="meta-right">PixelForge</span>
                                        {/* @ts-ignore */}
                                    </tc-game-showcase-card>
                                </div>
                            </SectionCard>

                            <SectionCard title="Clickable variant (role=button, keyboard-activatable, dispatches tc-click)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-game-showcase-card
                                        ref={clickableRef}
                                        title="Mind Maze"
                                        pitch="A contemplative puzzle game where each level reshapes your understanding of space."
                                    />
                                </div>
                                <p className="mt-2 text-muted" style={{ fontSize: '0.8125rem' }}>
                                    Click or press Enter/Space to activate. Check the browser console for the event log.
                                </p>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GameShowcaseCardDemo
