import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const PressAnyKeyDemo: React.FC = () => {
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog((l) => [msg, ...l].slice(0, 8))

    const defaultRef = useTcEvents<HTMLElement>({
        'tc-continue': (e: CustomEvent) =>
            appendLog(`tc-continue — "${e.type}" @ ${new Date().toLocaleTimeString()}`),
    })
    const customRef = useTcEvents<HTMLElement>({
        'tc-continue': (e: CustomEvent) =>
            appendLog(`tc-continue (custom text) @ ${new Date().toLocaleTimeString()}`),
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PressAnyKey"
                            description="Pulsing mono prompt that emits tc-continue on any non-modifier keydown (document-level) or mousedown. Use on splash screens, title screens, or any transition gate."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — dark surface (typical usage context)">
                                <div
                                    style={{
                                        padding: '60px 24px',
                                        textAlign: 'center',
                                        background: 'var(--tc-ink)',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-press-any-key ref={defaultRef} />
                                </div>
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click the element or press any key…
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

                            <tc-section-card title="Light surface">
                                <div
                                    style={{
                                        padding: '48px 24px',
                                        textAlign: 'center',
                                        background: 'var(--tc-surface)',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-press-any-key />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom text">
                                <div
                                    style={{
                                        padding: '48px 24px',
                                        textAlign: 'center',
                                        background: 'var(--tc-ink)',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-press-any-key
                                        ref={customRef}
                                        text="Press Space to Continue"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled state">
                                <div
                                    style={{
                                        padding: '48px 24px',
                                        textAlign: 'center',
                                        background: 'var(--tc-ink)',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-press-any-key disabled="" text="Press Any Key" />
                                </div>
                                <p
                                    className="text-muted mt-2 mb-0"
                                    style={{ fontSize: '0.8125rem' }}
                                >
                                    Disabled: event does not fire; animation is frozen; opacity
                                    reduced to 40%.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Custom theme">
                                <div
                                    style={{
                                        padding: '48px 24px',
                                        textAlign: 'center',
                                        background: 'var(--tc-ink)',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-press-any-key
                                        style={{
                                            '--bs-press-any-key-color': 'var(--tc-accent)',
                                            '--bs-press-any-key-color-hover': '#fff',
                                            '--bs-press-any-key-font-size': '0.9375rem',
                                            '--bs-press-any-key-pulse-duration': '1.2s',
                                        }}
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PressAnyKeyDemo
