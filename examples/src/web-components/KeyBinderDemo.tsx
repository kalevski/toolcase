import React, { useEffect, useRef, useState } from 'react'

const KeyBinderDemo: React.FC = () => {
    const interactiveRef = useRef<any>(null)
    const [lastEvent, setLastEvent] = useState<string>('—')
    const [boundKey, setBoundKey] = useState<string>('W')

    useEffect(() => {
        const el = interactiveRef.current
        if (!el) return
        const onChange = (e: CustomEvent<{ value: string; code: string }>) => {
            setLastEvent(`tc-change: ${e.detail.value} (${e.detail.code})`)
        }
        const onCancel = () => setLastEvent('tc-cancel')
        el.addEventListener('tc-change', onChange as EventListener)
        el.addEventListener('tc-cancel', onCancel)
        return () => {
            el.removeEventListener('tc-change', onChange as EventListener)
            el.removeEventListener('tc-cancel', onCancel)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Key Binder"
                            description="Click (or press Enter / Space) to enter capture mode, then press any key to assign the binding. Escape cancels. Emits tc-change with { value, code, key } or tc-cancel. Built in the toolcase idiom — flat slate surface, no gilded frame, no glow; the bound key label is JetBrains Mono."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Interactive — click to capture next key">
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-key-binder ref={interactiveRef} />
                                </div>
                                <p className="mt-3 mb-0 text-secondary">
                                    Last event: <code>{lastEvent}</code>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Pre-bound value">
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-key-binder value="W" />
                                    {/* @ts-ignore */}
                                    <tc-key-binder value="Space" />
                                    {/* @ts-ignore */}
                                    <tc-key-binder value="ArrowUp" />
                                    {/* @ts-ignore */}
                                    <tc-key-binder value="F1" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Empty / custom placeholder">
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-key-binder />
                                    {/* @ts-ignore */}
                                    <tc-key-binder placeholder="Press to bind…" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-key-binder value="Space" disabled />
                                    {/* @ts-ignore */}
                                    <tc-key-binder disabled />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Controlled via JS property">
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex align-items-center gap-3 flex-wrap">
                                        {/* @ts-ignore */}
                                        <tc-key-binder value={boundKey} />
                                    </div>
                                    <div className="d-flex gap-2 flex-wrap">
                                        {['W', 'A', 'S', 'D', 'Space', 'Shift'].map((k) => (
                                            <button
                                                key={k}
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => setBoundKey(k)}
                                            >
                                                Set "{k}"
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KeyBinderDemo
