import React, { useState } from 'react'

const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem' }
const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    borderBottom: '1px solid var(--tc-border)',
}

const ROWS = ['Golf VII 1.6 TDI', 'Astra J 1.7 CDTI', 'Octavia III 2.0 TDI', 'Focus III 1.5 TDCi']

const FloatingActionBarDemo: React.FC = () => {
    const [picked, setPicked] = useState<string[]>([])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FloatingActionBar"
                            description="The selection bar that floats over a list and stays lined up with the column it belongs to. Identical in all three consuming apps."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Selection
                            </tc-badge>
                        </tc-rich-page-header>

                        <div style={wrap} className="mt-4">
                            <tc-section-card title="Tick a row">
                                <div>
                                    {ROWS.map((row) => (
                                        <label key={row} style={rowStyle}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={picked.includes(row)}
                                                onChange={(e) =>
                                                    setPicked((current) =>
                                                        e.target.checked
                                                            ? [...current, row]
                                                            : current.filter(
                                                                  (entry) => entry !== row,
                                                              ),
                                                    )
                                                }
                                            />
                                            {row}
                                        </label>
                                    ))}
                                </div>

                                <tc-floating-action-bar
                                    open={picked.length > 0}
                                    label={`${picked.length} selected`}
                                >
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        size="sm"
                                        onClick={() => setPicked([])}
                                    >
                                        Clear
                                    </tc-button>
                                    <tc-button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => setPicked([])}
                                    >
                                        Delete
                                    </tc-button>
                                </tc-floating-action-bar>

                                <p style={note} className="mt-3">
                                    The host <em>is</em> the bar and what it measures is its own{' '}
                                    <strong>parent</strong>. All three apps rendered an in-flow
                                    anchor next to a fixed bar and measured that; the anchor is
                                    unnecessary, because the host already sits where you put it and
                                    its parent's box is the column. Dropping it also drops the
                                    question the anchor created — how do your actions get inside a
                                    box that is not their parent — which has only one answer that
                                    does not move your nodes.
                                </p>
                                <p style={note}>
                                    While it is open it publishes its own height as{' '}
                                    <code>--tc-action-bar-clearance</code> on the document root,
                                    which is what keeps a list's last row reachable above it.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FloatingActionBarDemo
