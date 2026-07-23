import React, { useEffect, useState } from 'react'
import { useTc, useTcEvents } from '@toolcase/web-components/react'

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
    const [basicOpen, setBasicOpen] = useState(false)
    const [eventsOpen, setEventsOpen] = useState(false)
    const [screenOpen, setScreenOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog((l) => [msg, ...l].slice(0, 10))

    // Basic demo
    const basicRef = useTc<HTMLElement>(
        { items: BASIC_ITEMS },
        {
            'tc-close': () => setBasicOpen(false),
            'tc-resume': () => setBasicOpen(false),
        }
    )

    useEffect(() => {
        if (!basicRef.current) return
        if (basicOpen) basicRef.current.setAttribute('open', '')
        else basicRef.current.removeAttribute('open')
    }, [basicOpen])

    // Events demo
    const eventsRef = useTc<HTMLElement>(
        { items: BADGE_ITEMS },
        {
            'tc-close': () => {
                appendLog('tc-close fired')
                setEventsOpen(false)
            },
            'tc-resume': () => {
                appendLog('tc-resume fired')
                setEventsOpen(false)
            },
            'tc-select': (e: CustomEvent) => appendLog(`tc-select — id: "${e.detail.id}"`),
        }
    )

    useEffect(() => {
        if (!eventsRef.current) return
        if (eventsOpen) eventsRef.current.setAttribute('open', '')
        else eventsRef.current.removeAttribute('open')
    }, [eventsOpen])

    // tc-pause-screen preset — default resume/restart/quit items + named events.
    const screenRef = useTcEvents<HTMLElement>({
        'tc-close': () => setScreenOpen(false),
        'tc-resume': () => {
            appendLog('tc-resume fired')
            setScreenOpen(false)
        },
        'tc-restart': () => {
            appendLog('tc-restart fired')
            setScreenOpen(false)
        },
        'tc-quit': () => {
            appendLog('tc-quit fired')
            setScreenOpen(false)
        },
    })

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
