import React, { useEffect, useRef, useState } from 'react'

const BASIC_ITEMS = [
    { id: 'resume', label: 'Resume' },
    { id: 'settings', label: 'Settings' },
    { id: 'load', label: 'Load Game' },
    { id: 'quit', label: 'Quit to Desktop' },
]

const BADGE_ITEMS = [
    { id: 'resume', label: 'Resume' },
    { id: 'settings', label: 'Settings', badge: 'New' },
    { id: 'achievements', label: 'Achievements', badge: '3' },
    { id: 'disabled', label: 'Leaderboards', disabled: true },
    { id: 'quit', label: 'Quit' },
]

const PauseMenuDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)
    const screenRef = useRef<any>(null)

    const [basicOpen, setBasicOpen] = useState(false)
    const [eventsOpen, setEventsOpen] = useState(false)
    const [screenOpen, setScreenOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog((l) => [msg, ...l].slice(0, 10))

    // Basic demo
    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.items = BASIC_ITEMS
        const onClose = () => setBasicOpen(false)
        const onResume = () => setBasicOpen(false)
        el.addEventListener('tc-close', onClose)
        el.addEventListener('tc-resume', onResume)
        return () => {
            el.removeEventListener('tc-close', onClose)
            el.removeEventListener('tc-resume', onResume)
        }
    }, [])

    useEffect(() => {
        if (!basicRef.current) return
        if (basicOpen) basicRef.current.setAttribute('open', '')
        else basicRef.current.removeAttribute('open')
    }, [basicOpen])

    // Events demo
    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.items = BADGE_ITEMS
        const onClose = () => {
            appendLog('tc-close fired')
            setEventsOpen(false)
        }
        const onResume = () => {
            appendLog('tc-resume fired')
            setEventsOpen(false)
        }
        const onSelect = (e: CustomEvent) => appendLog(`tc-select — id: "${e.detail.id}"`)
        el.addEventListener('tc-close', onClose)
        el.addEventListener('tc-resume', onResume)
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => {
            el.removeEventListener('tc-close', onClose)
            el.removeEventListener('tc-resume', onResume)
            el.removeEventListener('tc-select', onSelect as EventListener)
        }
    }, [])

    useEffect(() => {
        if (!eventsRef.current) return
        if (eventsOpen) eventsRef.current.setAttribute('open', '')
        else eventsRef.current.removeAttribute('open')
    }, [eventsOpen])

    // tc-pause-screen preset — default resume/restart/quit items + named events.
    useEffect(() => {
        const el = screenRef.current
        if (!el) return
        const close = () => setScreenOpen(false)
        const onResume = () => {
            appendLog('tc-resume fired')
            close()
        }
        const onRestart = () => {
            appendLog('tc-restart fired')
            close()
        }
        const onQuit = () => {
            appendLog('tc-quit fired')
            close()
        }
        el.addEventListener('tc-close', close)
        el.addEventListener('tc-resume', onResume)
        el.addEventListener('tc-restart', onRestart)
        el.addEventListener('tc-quit', onQuit)
        return () => {
            el.removeEventListener('tc-close', close)
            el.removeEventListener('tc-resume', onResume)
            el.removeEventListener('tc-restart', onRestart)
            el.removeEventListener('tc-quit', onQuit)
        }
    }, [])

    useEffect(() => {
        if (!screenRef.current) return
        if (screenOpen) screenRef.current.setAttribute('open', '')
        else screenRef.current.removeAttribute('open')
    }, [screenOpen])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PauseMenu"
                            description="In-game pause overlay with a backdrop, menu items, and a Resume button. Controlled component — fire tc-close / tc-resume to dismiss. Esc and backdrop click emit tc-close. Items are set via the JS items property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — four items, custom title">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setBasicOpen(true)}
                                >
                                    Pause game
                                </button>
                                {/* @ts-ignore */}
                                <tc-pause-menu ref={basicRef} menu-title="Realm of Ash" />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-select / tc-resume / tc-close, badges, disabled item">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setEventsOpen(true)}
                                >
                                    Pause game
                                </button>
                                {/* @ts-ignore */}
                                <tc-pause-menu ref={eventsRef} menu-title="Event Demo" />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Open the menu and interact…
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

                            <tc-section-card title="Preset alias: tc-pause-screen (default items + footer-less)">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setScreenOpen(true)}
                                >
                                    Open pause screen
                                </button>
                                {/* @ts-ignore */}
                                <tc-pause-screen ref={screenRef} screen-title="Realm of Ash" />
                                <div className="form-text mt-1">
                                    Seeds resume/restart/quit and re-dispatches tc-resume /
                                    tc-restart / tc-quit.
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PauseMenuDemo
