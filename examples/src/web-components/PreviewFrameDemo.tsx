import React from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const PreviewFrameDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="PreviewFrame"
                        description="An aspect-locked embed with a loading state and a failure state, because both of those are what the reader actually sees most of the time."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Editor
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-3 mt-4">
                        <tc-section-card title="Idle, loading, error">
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <tc-preview-frame
                                        ratio="16 / 9"
                                        title-text="Nothing to preview yet"
                                    />
                                    <p style={note} className="mt-2">
                                        idle — no src
                                    </p>
                                </div>
                                <div className="col-12 col-md-6">
                                    <tc-preview-frame
                                        ratio="16 / 9"
                                        src="about:blank"
                                        title-text="A build preview"
                                        loading-label="Waiting for the build…"
                                        error-label="That build did not answer."
                                    />
                                    <p style={note} className="mt-2">
                                        loading → ready
                                    </p>
                                </div>
                            </div>
                            <p style={note} className="mt-3">
                                The frame is the easy part. What earns an element is that an{' '}
                                <code>&lt;iframe&gt;</code> pointed at something you are{' '}
                                <em>building</em> fails in ways a plain iframe never reports — a
                                build that has not finished, an origin that refuses to be framed, a
                                URL that 404s while a name is being typed — and an iframe answers
                                all of them with a blank rectangle.
                            </p>
                            <p style={note}>
                                <strong>The aspect is locked, not the height.</strong> A preview
                                sized in px letterboxes on one screen and crops on another. And the
                                honest caveat: <code>onerror</code> fires for a network failure but{' '}
                                <em>not</em> for an X-Frame-Options refusal, which paints an empty
                                frame and reports success — that case is yours to detect with a
                                handshake, and the element does not claim to catch it.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default PreviewFrameDemo
