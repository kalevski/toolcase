import React, { useEffect, useRef, useState } from 'react'

const ListRowDemo: React.FC = () => {
    const [lastSelected, setLastSelected] = useState<string>('—')
    const interactiveRef = useRef<any>(null)

    useEffect(() => {
        const container = interactiveRef.current
        if (!container) return
        const handler = (e: Event) => {
            const row = e.target as HTMLElement
            setLastSelected(row.querySelector('.tc-list-row-label')?.textContent ?? '?')
        }
        container.addEventListener('tc-select', handler)
        return () => container.removeEventListener('tc-select', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="List Row"
                            description="A single selectable list row — leading media, label, trailing value/action — ported from gc-list-row. Selected/disabled state and an optional accent colour are controlled via attributes. Activating a non-disabled row (click, Enter, or Space) fires tc-select."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic rows — media · label · trailing value">
                                <div
                                    style={{ maxWidth: 400, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span
                                            className="tc-list-row-media"
                                            style={{ fontSize: '1.125rem' }}
                                        >
                                            📥
                                        </span>
                                        <span className="tc-list-row-label">Inbox</span>
                                        <span className="tc-list-row-meta">12</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span
                                            className="tc-list-row-media"
                                            style={{ fontSize: '1.125rem' }}
                                        >
                                            📤
                                        </span>
                                        <span className="tc-list-row-label">Sent</span>
                                        <span className="tc-list-row-meta">4</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span
                                            className="tc-list-row-media"
                                            style={{ fontSize: '1.125rem' }}
                                        >
                                            📝
                                        </span>
                                        <span className="tc-list-row-label">Drafts</span>
                                        <span className="tc-list-row-meta">2</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row disabled>
                                        <span
                                            className="tc-list-row-media"
                                            style={{ fontSize: '1.125rem' }}
                                        >
                                            🗑️
                                        </span>
                                        <span className="tc-list-row-label">Trash (disabled)</span>
                                        <span className="tc-list-row-meta">0</span>
                                    </tc-list-row>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Selected state">
                                <div
                                    style={{ maxWidth: 400, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span className="tc-list-row-label">Alpha release</span>
                                        <span className="tc-list-row-meta">v0.1.0</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row selected>
                                        <span className="tc-list-row-label">Beta release</span>
                                        <span className="tc-list-row-meta">v0.5.0</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span className="tc-list-row-label">Stable release</span>
                                        <span className="tc-list-row-meta">v1.0.0</span>
                                    </tc-list-row>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Accent colour override">
                                <div
                                    style={{ maxWidth: 400, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-list-row selected accent="var(--tc-success)">
                                        <span className="tc-list-row-label">Connected</span>
                                        <span className="tc-list-row-meta">online</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row selected accent="var(--tc-danger)">
                                        <span className="tc-list-row-label">Error detected</span>
                                        <span className="tc-list-row-meta">failed</span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row selected accent="var(--tc-warning)">
                                        <span className="tc-list-row-label">Warning threshold</span>
                                        <span className="tc-list-row-meta">78%</span>
                                    </tc-list-row>
                                </div>
                            </tc-section-card>

                            <tc-section-card
                                title={`Interactive — click or Enter / Space (last: ${lastSelected})`}
                            >
                                <div
                                    style={{ maxWidth: 400, border: '1px solid var(--tc-border)' }}
                                    ref={interactiveRef}
                                >
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span className="tc-list-row-body">
                                            <span className="tc-list-row-label">Dashboard</span>
                                        </span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span className="tc-list-row-body">
                                            <span className="tc-list-row-label">Settings</span>
                                        </span>
                                    </tc-list-row>
                                    {/* @ts-ignore */}
                                    <tc-list-row>
                                        <span className="tc-list-row-body">
                                            <span className="tc-list-row-label">Account</span>
                                        </span>
                                    </tc-list-row>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ListRowDemo
