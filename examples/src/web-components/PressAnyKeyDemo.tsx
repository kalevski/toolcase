import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PressAnyKeyDemo: React.FC = () => {
    const defaultRef = useRef<any>(null)
    const customRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog(l => [msg, ...l].slice(0, 8))

    useEffect(() => {
        const el = defaultRef.current
        if (!el) return
        const handler = (e: CustomEvent) => appendLog(`tc-continue — "${e.type}" @ ${new Date().toLocaleTimeString()}`)
        el.addEventListener('tc-continue', handler as EventListener)
        return () => el.removeEventListener('tc-continue', handler as EventListener)
    }, [])

    useEffect(() => {
        const el = customRef.current
        if (!el) return
        const handler = (e: CustomEvent) => appendLog(`tc-continue (custom text) @ ${new Date().toLocaleTimeString()}`)
        el.addEventListener('tc-continue', handler as EventListener)
        return () => el.removeEventListener('tc-continue', handler as EventListener)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PressAnyKey"
                            description="Pulsing mono prompt that emits tc-continue on any non-modifier keydown (document-level) or mousedown. Use on splash screens, title screens, or any transition gate."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default — dark surface (typical usage context)">
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
                                        <span className="text-muted">Click the element or press any key…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>

                            <SectionCard title="Light surface">
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
                            </SectionCard>

                            <SectionCard title="Custom text">
                                <div
                                    style={{
                                        padding: '48px 24px',
                                        textAlign: 'center',
                                        background: 'var(--tc-ink)',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-press-any-key ref={customRef} text="Press Space to Continue" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled state">
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
                                <p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8125rem' }}>
                                    Disabled: event does not fire; animation is frozen; opacity reduced to 40%.
                                </p>
                            </SectionCard>

                            <SectionCard title="Custom theme">
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
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PressAnyKeyDemo
