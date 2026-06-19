import React, { useState } from 'react'

const NavButtonDemo: React.FC = () => {
    const [log, setLog] = useState<string[]>([])

    const handleClick = (kind: string) => {
        setLog((l) => [`${kind} clicked`, ...l].slice(0, 6))
    }

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Nav Button"
                            description="Back / close navigation button ported from gc-nav-button. Renders as a compact square icon button using slate neutrals, sharp corners, and no game-specific chrome. Supports two kinds (back, close), an optional aria-label override, a custom pixel size, and a disabled state. All cosmetics flow through --bs-nav-button-* custom properties."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Kinds">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="back" />
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="close" />
                                </div>
                                <p className="mt-2 mb-0 text-muted" style={{ fontSize: '13px' }}>
                                    <code>kind="back"</code> renders a chevron-left;{' '}
                                    <code>kind="close"</code> renders an ×.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Custom size">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="back" size="24" />
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="back" size="32" />
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="back" size="48" />
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="close" size="48" />
                                </div>
                                <p className="mt-2 mb-0 text-muted" style={{ fontSize: '13px' }}>
                                    The <code>size</code> attribute accepts a plain number (px).
                                    Default is 32 px (2 rem).
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Custom aria-label">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="back" label="Go to previous step" />
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="close" label="Dismiss dialog" />
                                </div>
                                <p className="mt-2 mb-0 text-muted" style={{ fontSize: '13px' }}>
                                    The <code>label</code> attribute overrides the default
                                    aria-label ("Back" / "Close").
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Disabled state">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="back" disabled />
                                    {/* @ts-ignore */}
                                    <tc-nav-button kind="close" disabled />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Events — click the buttons">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-nav-button
                                        kind="back"
                                        onClick={() => handleClick('back')}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-nav-button
                                        kind="close"
                                        onClick={() => handleClick('close')}
                                    />
                                </div>
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click a button to see events…
                                        </span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom theming via CSS custom properties">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-nav-button
                                        kind="back"
                                        style={
                                            {
                                                '--bs-nav-button-color': 'var(--tc-app-accent)',
                                                '--bs-nav-button-hover-bg':
                                                    'rgba(30, 41, 59, 0.08)',
                                                '--bs-nav-button-border-color': 'var(--tc-border)',
                                                '--bs-nav-button-hover-border-color':
                                                    'var(--tc-border-strong)',
                                            } as React.CSSProperties
                                        }
                                    />
                                </div>
                                <p className="mt-2 mb-0 text-muted" style={{ fontSize: '13px' }}>
                                    Override <code>--bs-nav-button-*</code> on the host to retheme
                                    the button.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NavButtonDemo
