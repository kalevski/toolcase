import React, { useRef } from 'react'
import { useTc } from '@toolcase/web-components/react'

const MinimapDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({
        markers: [
            { id: 'player-a', x: 30, y: 25, color: 'var(--tc-success)', size: 10 },
            { id: 'enemy-1', x: 60, y: 40, color: 'var(--tc-danger)', size: 8 },
            { id: 'enemy-2', x: 75, y: 70 },
            { id: 'objective', x: 50, y: 50, color: 'var(--tc-warning)', size: 12 },
        ],
    })

    const rotatedRef = useTc<HTMLElement>({
        markers: [
            { id: 'ally-1', x: 20, y: 20, color: 'var(--tc-success)', size: 8 },
            { id: 'enemy-3', x: 80, y: 80, color: 'var(--tc-danger)', size: 8 },
            { id: 'enemy-4', x: 65, y: 30, color: 'var(--tc-danger)', size: 8 },
        ],
    })

    const largeRef = useTc<HTMLElement>({
        worldWidth: 200,
        worldHeight: 200,
        markers: [
            { id: 'squad-1', x: 10, y: 10, color: 'var(--tc-success)', size: 10 },
            { id: 'squad-2', x: 50, y: 80, color: 'var(--tc-success)', size: 10 },
            { id: 'squad-3', x: 120, y: 30, color: 'var(--tc-success)', size: 10 },
            { id: 'boss', x: 150, y: 160, color: 'var(--tc-danger)', size: 14 },
            { id: 'chest', x: 90, y: 90, color: 'var(--tc-warning)', size: 10 },
            { id: 'portal', x: 180, y: 40, color: 'var(--tc-accent)', size: 12 },
        ],
    })

    const emptyRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Minimap"
                            description="Positioned-marker map surface with a fixed player dot at centre. World coordinates are projected onto the surface; the rotation attribute spins the map around the player. Entity markers are circles; all other chrome is sharp. Set markers via the JS markers property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic minimap with entity markers">
                                {/* @ts-ignore */}
                                <tc-minimap ref={basicRef} world-width="100" world-height="100" />
                            </tc-section-card>

                            <tc-section-card title="Rotated 45°">
                                {/* @ts-ignore */}
                                <tc-minimap
                                    ref={rotatedRef}
                                    world-width="100"
                                    world-height="100"
                                    rotation="45"
                                />
                            </tc-section-card>

                            <tc-section-card title="Large map (300px) with custom world bounds">
                                {/* @ts-ignore */}
                                <tc-minimap ref={largeRef} size="300" />
                            </tc-section-card>

                            <tc-section-card title="Empty minimap">
                                {/* @ts-ignore */}
                                <tc-minimap ref={emptyRef} world-width="100" world-height="100" />
                            </tc-section-card>

                            <tc-section-card title="Custom size via attribute (size=160)">
                                {/* @ts-ignore */}
                                <tc-minimap size="160" world-width="100" world-height="100" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MinimapDemo
