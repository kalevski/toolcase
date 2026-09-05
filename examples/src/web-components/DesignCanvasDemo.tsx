import React from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const viewport: React.CSSProperties = { height: '360px' }
const layer: React.CSSProperties = {
    position: 'absolute',
    font: '600 34px var(--tc-font-sans)',
    color: '#10171a',
}

const DesignCanvasDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="DesignCanvas + Artboard"
                        description="The pan-and-zoom viewport an artboard sits in, and the artboard itself. From EditorStage and DesignArtboard, which webgame.cloud and mindmap both ship."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Editor
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-3 mt-4">
                        <tc-section-card title="Fit, then zoom">
                            <div className="d-flex justify-content-end mb-2">
                                <tc-zoom-control for="demo-canvas" />
                            </div>
                            <tc-design-canvas
                                id="demo-canvas"
                                content-width={800}
                                content-height={480}
                                style={viewport}
                            >
                                <tc-artboard width={800} height={480} label="Cover · 800×480">
                                    <span style={{ ...layer, left: '48px', top: '64px' }}>
                                        Toolcase
                                    </span>
                                    <span
                                        style={{
                                            ...layer,
                                            left: '48px',
                                            top: '120px',
                                            font: '400 20px var(--tc-font-sans)',
                                            color: '#626d68',
                                        }}
                                    >
                                        Framework-free web components
                                    </span>
                                </tc-artboard>
                            </tc-design-canvas>
                            <p style={note} className="mt-3">
                                <strong>Fit-then-zoom, not a raw scale.</strong> „100%" then means
                                „as large as this window allows", which is what a reader expects
                                from a design tool and never what a raw CSS scale gives.
                            </p>
                            <p style={note}>
                                <strong>The scale is published, not applied.</strong> The canvas
                                writes <code>--tc-canvas-scale</code> and lets the artboard read it.
                                Applying a transform would mean owning a wrapper around your
                                children, and moving a node you did not create is what makes
                                react-dom throw <code>NotFoundError</code>. Publishing a number
                                moves nothing.
                            </p>
                            <p style={note}>
                                Pointer contract: <kbd>Space</kbd> or the middle button drags,{' '}
                                <kbd>⌘/Ctrl</kbd> + wheel zooms about the pointer, <kbd>⌘/Ctrl</kbd>{' '}
                                + <kbd>0</kbd> fits. A plain drag is left alone entirely — it
                                belongs to whatever is on the artboard, and a canvas that steals it
                                is a canvas you cannot select anything on.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default DesignCanvasDemo
