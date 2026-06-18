import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DEFAULT_ITEMS = [
    { id: 'resume', label: 'Resume' },
    { id: 'restart', label: 'Restart' },
    { id: 'quit', label: 'Quit' },
]

const CUSTOM_ITEMS = [
    { id: 'resume', label: 'Resume' },
    { id: 'settings', label: 'Settings', badge: 'New' },
    { id: 'achievements', label: 'Achievements', badge: '3' },
    { id: 'leaderboard', label: 'Leaderboards', disabled: true },
    { id: 'quit', label: 'Quit to Menu' },
]

const PauseScreenDemo: React.FC = () => {
    const defaultRef = useRef<any>(null)
    const customRef = useRef<any>(null)

    const [defaultOpen, setDefaultOpen] = useState(false)
    const [customOpen, setCustomOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog(l => [msg, ...l].slice(0, 10))

    // Default items demo
    useEffect(() => {
        const el = defaultRef.current
        if (!el) return
        const onClose = () => setDefaultOpen(false)
        const onResume = () => { appendLog('tc-resume fired'); setDefaultOpen(false) }
        const onRestart = () => appendLog('tc-restart fired')
        const onQuit = () => appendLog('tc-quit fired')
        const onSelect = (e: CustomEvent) => appendLog(`tc-select — id: "${e.detail.id}"`)
        el.addEventListener('tc-close', onClose)
        el.addEventListener('tc-resume', onResume)
        el.addEventListener('tc-restart', onRestart)
        el.addEventListener('tc-quit', onQuit)
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => {
            el.removeEventListener('tc-close', onClose)
            el.removeEventListener('tc-resume', onResume)
            el.removeEventListener('tc-restart', onRestart)
            el.removeEventListener('tc-quit', onQuit)
            el.removeEventListener('tc-select', onSelect as EventListener)
        }
    }, [])

    useEffect(() => {
        if (!defaultRef.current) return
        if (defaultOpen) defaultRef.current.setAttribute('open', '')
        else defaultRef.current.removeAttribute('open')
    }, [defaultOpen])

    // Custom items demo
    useEffect(() => {
        const el = customRef.current
        if (!el) return
        el.items = CUSTOM_ITEMS
        const onClose = () => setCustomOpen(false)
        const onSelect = (e: CustomEvent) => appendLog(`tc-select — id: "${e.detail.id}"`)
        el.addEventListener('tc-close', onClose)
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => {
            el.removeEventListener('tc-close', onClose)
            el.removeEventListener('tc-select', onSelect as EventListener)
        }
    }, [])

    useEffect(() => {
        if (!customRef.current) return
        if (customOpen) customRef.current.setAttribute('open', '')
        else customRef.current.removeAttribute('open')
    }, [customOpen])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PauseScreen"
                            description="Full-screen pause overlay with a backdrop, eyebrow header, and a keyboard-navigable item list. Controlled component — fire tc-close / tc-resume to dismiss. Escape and backdrop click emit tc-close. The default items list [Resume, Restart, Quit] fires dedicated tc-resume, tc-restart, and tc-quit events in addition to tc-select."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — three built-in items, custom title">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setDefaultOpen(true)}
                                >
                                    Pause game
                                </button>
                                {/* @ts-ignore */}
                                <tc-pause-screen
                                    ref={defaultRef}
                                    screen-title="Realm of Ash"
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Open the screen and interact…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom items — badge, disabled row">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setCustomOpen(true)}
                                >
                                    Pause game
                                </button>
                                {/* @ts-ignore */}
                                <tc-pause-screen
                                    ref={customRef}
                                    screen-title="Custom Items Demo"
                                />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PauseScreenDemo
