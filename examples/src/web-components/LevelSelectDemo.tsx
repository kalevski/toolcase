import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const SIMPLE_NODES = [
    { id: '1', x: 100, y: 180, label: 'Level 1', completed: true, bestStars: 3, stars: 3 },
    { id: '2', x: 240, y: 100, label: 'Level 2', completed: true, bestStars: 2, stars: 3 },
    { id: '3', x: 240, y: 260, label: 'Level 3', completed: false },
    { id: '4', x: 380, y: 100, label: 'Level 4', locked: true },
    { id: '5', x: 380, y: 260, label: 'Level 5', locked: true },
    { id: '6', x: 500, y: 180, label: 'Boss', locked: true, icon: 'skull' },
]

const SIMPLE_EDGES = [
    { from: '1', to: '2' },
    { from: '1', to: '3' },
    { from: '2', to: '4' },
    { from: '3', to: '5' },
    { from: '4', to: '6' },
    { from: '5', to: '6' },
]

const ICON_NODES = [
    {
        id: 'a',
        x: 80,
        y: 150,
        label: 'Start',
        icon: 'play',
        completed: true,
        bestStars: 2,
        stars: 3,
    },
    {
        id: 'b',
        x: 220,
        y: 80,
        label: 'Forest',
        icon: 'trees',
        completed: true,
        bestStars: 3,
        stars: 3,
    },
    { id: 'c', x: 220, y: 220, label: 'Cave', icon: 'mountain', completed: false },
    { id: 'd', x: 360, y: 150, label: 'Castle', icon: 'castle', locked: true },
]

const ICON_EDGES = [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'b', to: 'd' },
    { from: 'c', to: 'd' },
]

// Wide map for the scrollable container demo.
const WIDE_NODES = [
    { id: 'w1', x: 80, y: 100, label: 'Stage 1', completed: true, bestStars: 3, stars: 3 },
    { id: 'w2', x: 200, y: 100, label: 'Stage 2', completed: true, bestStars: 1, stars: 3 },
    { id: 'w3', x: 320, y: 100, label: 'Stage 3', completed: false },
    { id: 'w4', x: 440, y: 100, label: 'Stage 4', locked: true },
    { id: 'w5', x: 560, y: 100, label: 'Stage 5', locked: true },
]

const WIDE_EDGES = [
    { from: 'w1', to: 'w2' },
    { from: 'w2', to: 'w3' },
    { from: 'w3', to: 'w4' },
    { from: 'w4', to: 'w5' },
]

const LevelSelectDemo: React.FC = () => {
    const [lastSelect, setLastSelect] = useState<string>('—')
    const [lastConfirm, setLastConfirm] = useState<string>('—')

    const basicRef = useTc<HTMLElement>(
        { nodes: SIMPLE_NODES, edges: SIMPLE_EDGES, selectedId: '3' },
        {
            'tc-select': (e: Event) => setLastSelect((e as CustomEvent).detail.id),
            'tc-confirm': (e: Event) => setLastConfirm((e as CustomEvent).detail.id),
        }
    )
    const iconRef = useTc<HTMLElement>({
        nodes: ICON_NODES,
        edges: ICON_EDGES,
        selectedId: 'b',
    })
    const wideRef = useTc<HTMLElement>({
        nodes: WIDE_NODES,
        edges: WIDE_EDGES,
        selectedId: 'w3',
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LevelSelect"
                            description="Level / stage selection grid with SVG edge connections between nodes. Each node can be locked, completed, or selected; optional star ratings show best performance. Emits tc-select on click and tc-confirm on double-click."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — locked, completed, selected states with star ratings">
                                {/* @ts-ignore */}
                                <tc-level-select ref={basicRef} width="600" height="360" />
                                <div className="mt-3 d-flex gap-4 small text-body-secondary">
                                    <span>
                                        Last tc-select: <strong>{lastSelect}</strong>
                                    </span>
                                    <span>
                                        Last tc-confirm: <strong>{lastConfirm}</strong>
                                    </span>
                                </div>
                                <p className="mt-2 mb-0 small text-body-secondary">
                                    Click an unlocked level to select it; double-click to fire
                                    tc-confirm. Locked nodes are not interactive.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Lucide icon glyphs">
                                {/* @ts-ignore */}
                                <tc-level-select ref={iconRef} width="440" height="300" />
                                <p className="mt-3 mb-0 small text-body-secondary">
                                    Pass a Lucide icon name (kebab-case) in the <code>icon</code>{' '}
                                    field to replace the default glyph. The star row is hidden when{' '}
                                    <code>bestStars</code> is omitted.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Wide map — scrollable container">
                                <div style={{ maxWidth: 320, overflowX: 'auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-level-select ref={wideRef} width="640" height="200" />
                                </div>
                                <p className="mt-3 mb-0 small text-body-secondary">
                                    Wrap in an <code>overflow-x: auto</code> container for wide maps
                                    on narrow viewports.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LevelSelectDemo
