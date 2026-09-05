import React, { useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const frame: React.CSSProperties = { height: '420px', border: '1px solid var(--tc-border)' }
const stage: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    height: '100%',
    color: 'var(--tc-text-faint)',
}
const tool: React.CSSProperties = {
    width: '2.25rem',
    height: '2.25rem',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid var(--tc-border)',
    background: 'var(--tc-surface)',
    cursor: 'pointer',
}

const EditorShellDemo: React.FC = () => {
    const [open, setOpen] = useState(true)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="EditorShell"
                            description="Toolbar, tool rail, stage, inspector, status. webgame.cloud and mindmap ship it identically; webgame.cloud's ToolShell is the same grid under a different vocabulary."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Editor
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="The five regions">
                                <div style={frame}>
                                    <tc-editor-shell
                                        inspector-open={open}
                                        inspector-label={open ? 'Hide panel' : 'Show panel'}
                                        ontc-inspector-toggle={(e) =>
                                            setOpen(Boolean(e.detail.open))
                                        }
                                    >
                                        <div slot="toolbar">
                                            <strong>Poster · A3</strong>
                                            <tc-badge size="xs" tone="neutral">
                                                draft
                                            </tc-badge>
                                        </div>
                                        <div slot="rail">
                                            <span style={tool}>▢</span>
                                            <span style={tool}>T</span>
                                            <span style={tool}>◯</span>
                                        </div>
                                        <div style={stage}>the stage — the default region</div>
                                        <div slot="inspector">
                                            <strong>Inspector</strong>
                                            <p style={note}>Whatever the selected thing needs.</p>
                                        </div>
                                        <div slot="status">
                                            <tc-zoom-control zoom={1} fit={0.62} />
                                        </div>
                                    </tc-editor-shell>
                                </div>
                                <p style={note} className="mt-3">
                                    <strong>Every region is yours.</strong> This element draws no
                                    toolbar, no rail and no inspector — it draws the grid they sit
                                    in, and nothing else. That is what makes it usable by two apps
                                    that agree on the layout and on nothing else, and why there is
                                    no re-parenting anywhere in it.
                                </p>
                                <p style={note}>
                                    The stage is the <em>default</em> region (no <code>slot</code>),
                                    because it is the one region that always exists and the one a
                                    consumer forgets to name.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EditorShellDemo
