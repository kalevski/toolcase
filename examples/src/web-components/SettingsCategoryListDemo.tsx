import React, { useEffect, useRef, useState } from 'react'

const CATS = [
    { id: 'graphics', label: 'Graphics', icon: 'monitor' },
    { id: 'audio', label: 'Audio', icon: 'volume-2' },
    { id: 'controls', label: 'Controls', icon: 'gamepad-2' },
    { id: 'gameplay', label: 'Gameplay', icon: 'swords' },
    { id: 'account', label: 'Account', icon: 'user' },
]

const CONTENT: Record<string, string> = {
    graphics: 'Adjust resolution, frame rate cap, shadow quality, and anti-aliasing settings.',
    audio: 'Control master, music, effects, and voice volumes.',
    controls: 'Rebind keyboard shortcuts, mouse sensitivity, and controller layout.',
    gameplay: 'Toggle UI hints, difficulty scaling, auto-save frequency, and subtitles.',
    account: 'Manage your account, linked providers, and notification preferences.',
}

const SettingsCategoryListDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const iconsRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [selected, setSelected] = useState('graphics')
    const [log, setLog] = useState<string[]>([])

    // Basic — lucide icons
    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.categories = CATS
        }
    }, [])

    // No-icon variant
    useEffect(() => {
        if (iconsRef.current) {
            iconsRef.current.categories = CATS.map((c) => ({ id: c.id, label: c.label }))
        }
    }, [])

    // Events demo
    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.categories = CATS

        const handler = (e: CustomEvent) => {
            setSelected(e.detail.id)
            setLog((l) => [`tc-select  id="${e.detail.id}"`, ...l].slice(0, 8))
        }
        el.addEventListener('tc-select', handler as EventListener)
        return () => el.removeEventListener('tc-select', handler as EventListener)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SettingsCategoryList"
                            description="Settings sidebar with a slotted content area on the right. Driven by the categories JS property; fires tc-select when the active category changes."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="With lucide icons — graphics selected">
                                {/* @ts-ignore */}
                                <tc-settings-category-list
                                    ref={basicRef}
                                    selected-id="graphics"
                                    style={{ border: '1px solid var(--tc-border)', height: 260 }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        {CONTENT['graphics']}
                                    </p>
                                    {/* @ts-ignore */}
                                </tc-settings-category-list>
                            </tc-section-card>

                            <tc-section-card title="Without icons">
                                {/* @ts-ignore */}
                                <tc-settings-category-list
                                    ref={iconsRef}
                                    selected-id="audio"
                                    style={{ border: '1px solid var(--tc-border)', height: 260 }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        {CONTENT['audio']}
                                    </p>
                                    {/* @ts-ignore */}
                                </tc-settings-category-list>
                            </tc-section-card>

                            <tc-section-card title="Events — tc-select">
                                {/* @ts-ignore */}
                                <tc-settings-category-list
                                    ref={eventsRef}
                                    selected-id={selected}
                                    style={{ border: '1px solid var(--tc-border)', height: 260 }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        {CONTENT[selected] ?? ''}
                                    </p>
                                    {/* @ts-ignore */}
                                </tc-settings-category-list>

                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click a category to see events…
                                        </span>
                                    ) : (
                                        <ul className="mb-0 ps-0 list-unstyled">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsCategoryListDemo
