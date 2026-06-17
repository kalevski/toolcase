import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MinimapDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const rotatedRef = useRef<any>(null)
    const largeRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.markers = [
                { id: 'player-a', x: 30, y: 25, color: 'var(--tc-success)', size: 10 },
                { id: 'enemy-1', x: 60, y: 40, color: 'var(--tc-danger)', size: 8 },
                { id: 'enemy-2', x: 75, y: 70 },
                { id: 'objective', x: 50, y: 50, color: 'var(--tc-warning)', size: 12 },
            ]
        }
    }, [])

    useEffect(() => {
        if (rotatedRef.current) {
            rotatedRef.current.markers = [
                { id: 'ally-1', x: 20, y: 20, color: 'var(--tc-success)', size: 8 },
                { id: 'enemy-3', x: 80, y: 80, color: 'var(--tc-danger)', size: 8 },
                { id: 'enemy-4', x: 65, y: 30, color: 'var(--tc-danger)', size: 8 },
            ]
        }
    }, [])

    useEffect(() => {
        if (largeRef.current) {
            largeRef.current.worldWidth = 200
            largeRef.current.worldHeight = 200
            largeRef.current.markers = [
                { id: 'squad-1', x: 10, y: 10, color: 'var(--tc-success)', size: 10 },
                { id: 'squad-2', x: 50, y: 80, color: 'var(--tc-success)', size: 10 },
                { id: 'squad-3', x: 120, y: 30, color: 'var(--tc-success)', size: 10 },
                { id: 'boss', x: 150, y: 160, color: 'var(--tc-danger)', size: 14 },
                { id: 'chest', x: 90, y: 90, color: 'var(--tc-warning)', size: 10 },
                { id: 'portal', x: 180, y: 40, color: 'var(--tc-accent)', size: 12 },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Minimap"
                            description="Positioned-marker map surface with a fixed player dot at centre. World coordinates are projected onto the surface; the rotation attribute spins the map around the player. Entity markers are circles; all other chrome is sharp. Set markers via the JS markers property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic minimap with entity markers">
                                {/* @ts-ignore */}
                                <tc-minimap ref={basicRef} world-width="100" world-height="100" />
                            </SectionCard>

                            <SectionCard title="Rotated 45°">
                                {/* @ts-ignore */}
                                <tc-minimap ref={rotatedRef} world-width="100" world-height="100" rotation="45" />
                            </SectionCard>

                            <SectionCard title="Large map (300px) with custom world bounds">
                                {/* @ts-ignore */}
                                <tc-minimap ref={largeRef} size="300" />
                            </SectionCard>

                            <SectionCard title="Empty minimap">
                                {/* @ts-ignore */}
                                <tc-minimap ref={emptyRef} world-width="100" world-height="100" />
                            </SectionCard>

                            <SectionCard title="Custom size via attribute (size=160)">
                                {/* @ts-ignore */}
                                <tc-minimap size="160" world-width="100" world-height="100" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MinimapDemo
