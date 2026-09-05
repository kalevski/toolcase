import React, { useEffect, useRef } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const scroller: React.CSSProperties = {
    overflow: 'auto',
    maxHeight: '460px',
    background: 'var(--tc-surface-muted)',
}
const nodeBox: React.CSSProperties = {
    width: '150px',
    padding: '0.5rem 0.625rem',
    background: 'var(--tc-surface)',
    border: '1px solid var(--tc-border)',
    fontSize: '0.8125rem',
    textAlign: 'center',
}

const NODES = [
    { id: 'root', label: 'Product research' },
    // A heavy branch: no more than eight direct children (so it stays a ring,
    // not a grid), but enough of its OWN descendants that its slice of the
    // ring should visibly outweigh a same-level leaf.
    { id: 'a', parent: 'root', label: 'Competitors' },
    { id: 'a1', parent: 'a', label: 'Direct' },
    { id: 'a2', parent: 'a', label: 'Adjacent' },
    { id: 'a1-1', parent: 'a1', label: 'Local' },
    { id: 'a1-2', parent: 'a1', label: 'National' },
    { id: 'a2-1', parent: 'a2', label: 'Adjacent A' },
    { id: 'a2-2', parent: 'a2', label: 'Adjacent B' },
    { id: 'a2-3', parent: 'a2', label: 'Adjacent C' },
    // A block past the eight-sibling cap: becomes a grid, sized from what
    // each cell actually needs — Europe alone carries its own sub-branch.
    { id: 'b', parent: 'root', label: 'Pricing' },
    { id: 'b1', parent: 'b', label: 'Europe' },
    { id: 'b1-1', parent: 'b1', label: 'Germany' },
    { id: 'b1-2', parent: 'b1', label: 'France' },
    { id: 'b1-3', parent: 'b1', label: 'Spain' },
    { id: 'b2', parent: 'b', label: 'US' },
    { id: 'b3', parent: 'b', label: 'APAC' },
    { id: 'b4', parent: 'b', label: 'LatAm' },
    { id: 'b5', parent: 'b', label: 'MEA' },
    { id: 'b6', parent: 'b', label: 'Nordics' },
    { id: 'b7', parent: 'b', label: 'UK' },
    { id: 'b8', parent: 'b', label: 'Canada' },
    { id: 'b9', parent: 'b', label: 'Australia' },
    { id: 'b10', parent: 'b', label: 'Japan' },
    // Two plain leaves, for contrast against the two branches above.
    { id: 'c', parent: 'root', label: 'Interviews' },
    { id: 'd', parent: 'root', label: 'Positioning' },
]

const GraphCanvasDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        if (ref.current) (ref.current as never as { nodes: unknown }).nodes = NODES
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="GraphCanvas"
                            description="A radial tidy tree: one centre, its children on a ring, their children on the next ring out. From mindmap's NoteGraphCanvas and its layout helper."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Data
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="The layout, with your own node boxes">
                                <div style={scroller}>
                                    <tc-graph-canvas ref={ref} ring-gap={190} node-width={150}>
                                        {NODES.map((node) => (
                                            <div
                                                key={node.id}
                                                data-node-id={node.id}
                                                style={nodeBox}
                                            >
                                                {node.label}
                                            </div>
                                        ))}
                                    </tc-graph-canvas>
                                </div>
                                <p style={note} className="mt-3">
                                    <strong>A ring's radius grows with its sibling count</strong>,
                                    not with its level. A fixed radius works until a node has eleven
                                    children, at which point eleven cards are drawn on a circle
                                    whose circumference cannot hold them. Past eight siblings the
                                    ring becomes a <em>grid</em> instead — Pricing's ten regions
                                    here — sized from what each cell actually needs, so Europe's own
                                    sub-branch doesn't crowd its neighbours.
                                </p>
                                <p style={note}>
                                    <strong>A child's slice of the ring is weighted by its own
                                    subtree</strong>, not split evenly: Competitors carries six
                                    descendants of its own and visibly claims more of the circle
                                    than Interviews or Positioning, which are single leaves — and
                                    the two branches still can't crowd into each other's arc.
                                </p>
                                <p style={note}>
                                    <strong>Cards shrink by level</strong> — a third-ring node is
                                    context, not content, and drawing it at the size of the centre
                                    is what makes a radial graph unreadable at exactly the moment it
                                    has enough in it to be worth drawing.
                                </p>
                                <p style={note}>
                                    <strong>Links are trimmed to the card's edge and bent</strong>,
                                    never drawn centre to centre, and every child of one parent
                                    leaves that parent from the same point — which is what makes the
                                    drawing read as a tree rather than a scatter of sticks.
                                </p>
                                <p style={note}>
                                    The element draws the layout and hands each box back through{' '}
                                    <code>--tc-node-*</code>; the contents are yours, as direct
                                    children carrying <code>data-node-id</code>. Nothing is moved
                                    into a wrapper, so a conditionally-rendered node is safe.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GraphCanvasDemo
