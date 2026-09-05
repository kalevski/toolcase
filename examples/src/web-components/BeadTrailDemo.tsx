import React, { useEffect, useRef } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const card: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.625rem 0',
    borderBottom: '1px solid var(--tc-border)',
}

const SHALLOW = [{ id: 'r', label: 'Kitchen' }]
const DEEP = [
    { id: 'r', label: 'Product research' },
    { id: 'a', label: 'Competitors' },
    { id: 'b', label: 'Pricing' },
    { id: 'c', label: 'Europe' },
    { id: 'd', label: 'Q3' },
]

const BeadTrailDemo: React.FC = () => {
    const shallow = useRef<HTMLElement>(null)
    const deep = useRef<HTMLElement>(null)
    const root = useRef<HTMLElement>(null)

    useEffect(() => {
        if (shallow.current) (shallow.current as never as { crumbs: unknown }).crumbs = SHALLOW
        if (deep.current) (deep.current as never as { crumbs: unknown }).crumbs = DEEP
        if (root.current) (root.current as never as { crumbs: unknown }).crumbs = []
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BeadTrail"
                            description="A breadcrumb that shows depth as beads and the path as names. From mindmap's recent-cards trail."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Navigation
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Depth first, names second">
                                <div style={card}>
                                    <tc-bead-trail ref={root} root-label="at the root" />
                                    <strong>Shopping list</strong>
                                </div>
                                <div style={card}>
                                    <tc-bead-trail ref={shallow} />
                                    <strong>Tomatoes</strong>
                                </div>
                                <div style={card}>
                                    <tc-bead-trail ref={deep} />
                                    <strong>Renewal rates</strong>
                                </div>

                                <p style={note} className="mt-3">
                                    A chevron breadcrumb answers „where is this", but only if the
                                    whole path fits — and in a tree that goes six deep it never
                                    does, so every implementation elides the middle and the reader
                                    loses the one fact they wanted: how far down this thing lives.
                                </p>
                                <p style={note}>
                                    The beads answer that first: one per level, the last one marked,
                                    so „fifth of five" is legible before a single name is read.
                                    Beyond the cap the middle names are replaced by one ellipsis and
                                    the first and last are kept — the root says which tree, the
                                    parent says which branch, and the levels between are what the
                                    beads already carried.
                                </p>
                                <p style={note}>
                                    <strong>Not tc-breadcrumb.</strong> That one is the page's own
                                    path, a navigation landmark you are standing on. This says where
                                    a thing in a <em>list</em> lives, for a reader standing
                                    somewhere else entirely.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BeadTrailDemo
