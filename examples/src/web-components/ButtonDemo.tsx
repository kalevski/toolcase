import React from 'react'

const ButtonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Button"
                        description="Bootstrap button wrapper with variant, outline, size, loading, and link support."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Variants">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Primary</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary">Secondary</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success">Success</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="danger">Danger</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="warning">Warning</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="info">Info</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="light">Light</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="dark">Dark</tc-button>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Outline">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" outline>
                                    Primary
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" outline>
                                    Secondary
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success" outline>
                                    Success
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="danger" outline>
                                    Danger
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="warning" outline>
                                    Warning
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="info" outline>
                                    Info
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="light" outline>
                                    Light
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="dark" outline>
                                    Dark
                                </tc-button>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" size="lg">
                                    Large
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Default</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary" size="sm">
                                    Small
                                </tc-button>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Block + the thumb tier (xl)">
                            <p className="text-muted small mb-3">
                                <code>block</code> makes the button span its container and centre
                                its content — the shape of every action bar and sheet footer in a
                                phone layout. <code>size=&quot;xl&quot;</code> is the 66px thumb
                                tier: a target sized to be hit while looking at the pan instead of
                                the screen. It is a NEW tier rather than a taller <code>-lg</code>,
                                because <code>-lg</code> is the CTA size on every landing page
                                consuming this library.
                            </p>
                            <div
                                style={{
                                    maxWidth: 390,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-button variant="primary" block>
                                    Побарај соработка
                                </tc-button>
                                {/* A two-action row: both are `block`, so `flex: 1 1 0` splits the
                                    row evenly instead of sizing each to its own label. */}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-button variant="primary" outline block>
                                        Откажи
                                    </tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="primary" block>
                                        Примени (3)
                                    </tc-button>
                                </div>
                                {/* @ts-ignore */}
                                <tc-button variant="primary" size="xl" block>
                                    Следен чекор
                                </tc-button>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Loading">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" loading>
                                    Saving…
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" loading>
                                    Loading…
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success" outline loading>
                                    Processing…
                                </tc-button>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" disabled>
                                    Disabled
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" outline disabled>
                                    Disabled
                                </tc-button>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Link (href)">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" href="#">
                                    Link button
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="info" outline href="#">
                                    Outline link
                                </tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" href="#" disabled>
                                    Disabled link
                                </tc-button>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ButtonDemo
