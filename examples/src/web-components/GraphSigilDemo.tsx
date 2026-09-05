import React from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0',
    borderBottom: '1px solid var(--tc-border)',
}

const GRAPHS = [
    { id: 'a7f31', title: 'Reading notes', ring: 4, depth: 3 },
    { id: 'b2c90', title: 'Kitchen', ring: 9, depth: 2 },
    { id: 'c8811', title: 'Product research', ring: 14, depth: 4 },
    { id: 'd0042', title: 'Notes', ring: 1, depth: 1 },
]

const GraphSigilDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="GraphSigil"
                        description="A miniature of a tree's own first ring, used as its identity mark. From mindmap."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Data
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-3 mt-4">
                        <tc-section-card title="A list of trees">
                            {GRAPHS.map((graph) => (
                                <div key={graph.id} style={row}>
                                    <tc-graph-sigil
                                        seed={graph.id}
                                        ring={graph.ring}
                                        depth={graph.depth}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{graph.title}</div>
                                        <div style={note}>
                                            {graph.ring} branches · {graph.depth} deep
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <p style={note} className="mt-3">
                                The two usual answers are both bad. A screenshot is expensive to
                                make, stale the moment anything changes, and unreadable at 72px. A
                                letter avatar says nothing about the thing — two graphs called
                                „Notes" get the same mark.
                            </p>
                            <p style={note}>
                                A sigil is drawn <strong>from the data</strong>: the ring count is
                                the depth, the satellite count is the root's children, and the
                                rotation is seeded from the id — so two trees look alike exactly
                                when they are alike, a tree's mark changes as it grows, and the same
                                tree is drawn the same way forever without storing anything. Past
                                nine satellites the ring is drawn as <em>full</em> rather than the
                                extra dots being dropped silently.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default GraphSigilDemo
