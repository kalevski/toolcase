import React from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const ZoomControlDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="ZoomControl"
                        description="Minus, the percentage, plus, and “fit”. EditorZoom in webgame.cloud and mindmap, identical."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Editor
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-3 mt-4">
                        <tc-section-card title="Standalone">
                            <tc-zoom-control zoom={1} fit={0.62} />
                            <p style={note} className="mt-3">
                                It is small enough that duplicating it looks harmless, which is
                                exactly why both apps did — and both then had to keep the same four
                                decisions in step: that the figure is <code>fit × zoom</code> and
                                not <code>zoom</code>, that it is rounded to whole percent, that
                                „fit" is a word rather than a third glyph, and that the steps come
                                from a ladder rather than a multiplier.
                            </p>
                            <p style={note}>
                                Given a <code>for</code> it drives a <code>tc-design-canvas</code>{' '}
                                and mirrors its zoom with no wiring at all — see the DesignCanvas
                                demo.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ZoomControlDemo
