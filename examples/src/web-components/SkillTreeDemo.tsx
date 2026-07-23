import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const NODES = [
    {
        id: 's1',
        x: 100,
        y: 200,
        label: 'Strike',
        icon: 'sword',
        unlocked: true,
        rank: 3,
        maxRank: 3,
        description: 'Basic melee attack',
    },
    {
        id: 's2',
        x: 260,
        y: 110,
        label: 'Parry',
        icon: 'shield',
        unlocked: true,
        rank: 1,
        maxRank: 3,
        description: 'Block incoming attacks',
    },
    {
        id: 's3',
        x: 260,
        y: 290,
        label: 'Stance',
        icon: 'footprints',
        unlocked: true,
        rank: 2,
        maxRank: 3,
        description: 'Combat stance adjustment',
    },
    {
        id: 's4',
        x: 420,
        y: 110,
        label: 'Riposte',
        icon: 'zap',
        rank: 0,
        maxRank: 3,
        description: 'Counter-attack after a parry',
    },
    {
        id: 's5',
        x: 420,
        y: 290,
        label: 'Endure',
        icon: 'heart-pulse',
        rank: 0,
        maxRank: 3,
        description: 'Increase stamina regeneration',
    },
    {
        id: 's6',
        x: 560,
        y: 200,
        label: 'Mastery',
        icon: 'star',
        locked: true,
        rank: 0,
        maxRank: 1,
        description: 'Requires all prerequisite skills',
    },
]

const EDGES = [
    { from: 's1', to: 's2' },
    { from: 's1', to: 's3' },
    { from: 's2', to: 's4' },
    { from: 's3', to: 's5' },
    { from: 's4', to: 's6' },
    { from: 's5', to: 's6' },
]

const SIMPLE_NODES = [
    { id: 'a', x: 80, y: 120, label: 'Basics' },
    { id: 'b', x: 220, y: 60, label: 'Advanced', unlocked: true },
    { id: 'c', x: 220, y: 180, label: 'Defense', unlocked: true },
    { id: 'd', x: 360, y: 120, label: 'Expert', locked: true },
]

const SIMPLE_EDGES = [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'b', to: 'd' },
    { from: 'c', to: 'd' },
]

const SkillTreeDemo: React.FC = () => {
    const [lastSelect, setLastSelect] = useState<string>('—')
    const [lastUnlock, setLastUnlock] = useState<string>('—')

    const fullRef = useTc<HTMLElement>(
        { nodes: NODES, edges: EDGES },
        {
            'tc-select': (e: Event) => setLastSelect((e as CustomEvent).detail.id),
            'tc-unlock': (e: Event) => setLastUnlock((e as CustomEvent).detail.id),
        }
    )

    const simpleRef = useTc<HTMLElement>({ nodes: SIMPLE_NODES, edges: SIMPLE_EDGES })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SkillTree"
                            description="Node-graph skill tree with prerequisite edges, locked/unlocked/selected states, rank counters, and a remaining-points readout. Emits tc-select on click and tc-unlock on double-click."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full talent tree — locked, unlocked, rank counters, points readout">
                                {/* @ts-ignore */}
                                <tc-skill-tree
                                    ref={fullRef}
                                    selected-id="s4"
                                    points="3"
                                    width="660"
                                    height="380"
                                />
                                <div className="mt-3 d-flex gap-4 small text-body-secondary">
                                    <span>
                                        Last tc-select: <strong>{lastSelect}</strong>
                                    </span>
                                    <span>
                                        Last tc-unlock: <strong>{lastUnlock}</strong>
                                    </span>
                                </div>
                                <p className="mt-2 mb-0 small text-body-secondary">
                                    Click an unlocked node to select it; double-click to fire{' '}
                                    <code>tc-unlock</code>. Locked nodes are not interactive. Hover
                                    a node to see its description tooltip.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Minimal — available and locked states, no icons">
                                {/* @ts-ignore */}
                                <tc-skill-tree ref={simpleRef} width="440" height="240" />
                                <p className="mt-3 mb-0 small text-body-secondary">
                                    Nodes with no <code>icon</code> field render a dot glyph in the
                                    default state or a check glyph when <code>unlocked: true</code>.
                                    Locked nodes are dimmed and not interactive.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SkillTreeDemo
