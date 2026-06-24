import React, { useState } from 'react'

const TitleScreenDemo: React.FC = () => {
    const [showBasic, setShowBasic] = useState(false)
    const [showTitle, setShowTitle] = useState(false)
    const [showFull, setShowFull] = useState(false)
    const [showCustom, setShowCustom] = useState(false)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Title Screen"
                            description="Full-viewport game title / start screen. Covers the viewport when present in the DOM; add or remove it (or toggle [hidden]) to show or hide it. Port of gc-title-screen — game chrome (diamond dividers, gilded frames) replaced with the slate design system: sharp corners, 1px hairline divider, JetBrains Mono eyebrow."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Eyebrow only">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    The minimum configuration — only the <code>eyebrow</code> prompt
                                    is shown (default: <code>"Press Start"</code>). The title
                                    heading and subtitle are omitted when their attributes are
                                    absent.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowBasic(true)}
                                    disabled={showBasic}
                                >
                                    Show title screen
                                </button>

                                {showBasic && (
                                    <>
                                        {/* @ts-ignore */}
                                        <tc-title-screen />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '2rem',
                                                right: '2rem',
                                                zIndex: 1061,
                                            }}
                                        >
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowBasic(false)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}
                            </tc-section-card>

                            <tc-section-card title="With title">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Adding a <code>title-text</code> attribute renders an{' '}
                                    <code>&lt;h1&gt;</code> heading above the hairline divider.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowTitle(true)}
                                    disabled={showTitle}
                                >
                                    Show with title
                                </button>

                                {showTitle && (
                                    <>
                                        {/* @ts-ignore */}
                                        <tc-title-screen title-text="Realm of Ash" />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '2rem',
                                                right: '2rem',
                                                zIndex: 1061,
                                            }}
                                        >
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowTitle(false)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Title + subtitle">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Adding a <code>subtitle</code> attribute renders a muted
                                    paragraph below the hairline divider.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowFull(true)}
                                    disabled={showFull}
                                >
                                    Show with subtitle
                                </button>

                                {showFull && (
                                    <>
                                        {/* @ts-ignore */}
                                        <tc-title-screen
                                            title-text="Realm of Ash"
                                            subtitle="A world on the edge of ruin."
                                        />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '2rem',
                                                right: '2rem',
                                                zIndex: 1061,
                                            }}
                                        >
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowFull(false)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Custom eyebrow">
                                <p className="mb-3" style={{ opacity: 0.85 }}>
                                    Override the default <code>"Press Start"</code> eyebrow via the{' '}
                                    <code>eyebrow</code> attribute — useful for attract screens,
                                    credits, or any static splash that needs a different prompt.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowCustom(true)}
                                    disabled={showCustom}
                                >
                                    Show custom eyebrow
                                </button>

                                {showCustom && (
                                    <>
                                        {/* @ts-ignore */}
                                        <tc-title-screen
                                            eyebrow="Click anywhere to begin"
                                            title-text="The Last Siege"
                                            subtitle="An epic strategy experience."
                                        />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '2rem',
                                                right: '2rem',
                                                zIndex: 1061,
                                            }}
                                        >
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowCustom(false)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TitleScreenDemo
