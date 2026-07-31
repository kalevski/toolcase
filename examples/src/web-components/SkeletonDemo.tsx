import React from 'react'

const SkeletonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Skeleton"
                        description="Loading-state placeholder with customizable shape and dimensions. Three variants: text (stacked lines), circle (equal width/height), and rect (sharp block)."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Text — single line">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="text"></tc-skeleton>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Text — multiple lines (count)">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="text" count="4"></tc-skeleton>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Circle (with width / height)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-skeleton variant="circle" width="40" height="40"></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="circle" width="64" height="64"></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="circle" width="96" height="96"></tc-skeleton>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Rect">
                            <div style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="rect" width="100%" height="120"></tc-skeleton>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Presets — card & row">
                            <p className="text-muted small mb-3">
                                A preset reproduces another component's BOX rather than a rectangle:{' '}
                                <code>card</code> matches <code>tc-taxonomy-card</code> and{' '}
                                <code>row</code> matches <code>tc-check-row</code>. A list that
                                loads into cards but shimmers as flat bars reflows on arrival —
                                every row changes height and the page jumps. Matching the geometry
                                makes the loading state a silhouette of the loaded one, so nothing
                                moves when the data lands.
                            </p>
                            <div
                                style={{
                                    maxWidth: 390,
                                    display: 'flex',
                                    gap: '0.75rem',
                                    flexDirection: 'column',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-skeleton preset="card" count={3}></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton preset="row" count={5}></tc-skeleton>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Card skeleton (composed)">
                            <div
                                style={{
                                    maxWidth: 320,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-skeleton variant="rect" width="100%" height="160"></tc-skeleton>
                                {/* @ts-ignore */}
                                <tc-skeleton variant="text" count="3"></tc-skeleton>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SkeletonDemo
