import React, { useEffect, useRef, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

type Level = 'info' | 'success' | 'warning' | 'danger'

interface DemoEvent {
    id?: string
    time?: string
    label: string
    level?: Level
    icon?: string
}

function makeTimestamp(): string {
    const d = new Date()
    return d.toTimeString().slice(0, 8)
}

const INITIAL_EVENTS: DemoEvent[] = [
    {
        id: 'e1',
        time: '10:00:01',
        label: 'Service started',
        level: 'success',
        icon: 'circle-check',
    },
    { id: 'e2', time: '10:00:04', label: 'Connected to database', level: 'info' },
    { id: 'e3', time: '10:00:07', label: 'Config loaded from /etc/app.conf', level: 'info' },
    { id: 'e4', time: '10:00:12', label: 'Cache warming up (72%)' },
    { id: 'e5', time: '10:00:18', label: 'Disk usage above 80%', level: 'warning' },
    { id: 'e6', time: '10:00:23', label: 'Retry #1 — upstream timeout', level: 'danger' },
    { id: 'e7', time: '10:00:29', label: 'Upstream reconnected', level: 'success' },
]

const LIVE_MESSAGES: { label: string; level?: Level }[] = [
    { label: 'Request dispatched to worker-03', level: 'info' },
    { label: 'Cache hit ratio 94.2%', level: 'success' },
    { label: 'Slow query detected (320 ms)', level: 'warning' },
    { label: 'Health check passed' },
    { label: 'WebSocket client connected', level: 'info' },
    { label: 'Payload parse error', level: 'danger' },
    { label: 'Job queue flushed', level: 'success' },
    { label: 'Memory usage 1.2 GB' },
    { label: 'TLS certificate renewal scheduled', level: 'info' },
]

let _msgIdx = 0
let _idCounter = 0

function nextEvent(): DemoEvent {
    const msg = LIVE_MESSAGES[_msgIdx % LIVE_MESSAGES.length]
    _msgIdx++
    return { id: `live-${++_idCounter}`, time: makeTimestamp(), ...msg }
}

const LiveFeedDemo: React.FC = () => {
    const autoScrollRef = useRef<any>(null)
    const maxRowsRef = useRef<any>(null)
    const [clickedRow, setClickedRow] = useState<string | null>(null)

    const basicRef = useTc<HTMLElement>({ events: [...INITIAL_EVENTS] })
    const recordingRef = useTc<HTMLElement>({ events: [...INITIAL_EVENTS] })
    const clickRef = useTc<HTMLElement>(
        { events: [...INITIAL_EVENTS] },
        {
            'tc-row-click': (e: CustomEvent) => {
                const { id, event } = e.detail
                setClickedRow(`id=${id ?? 'n/a'} label="${event.label}"`)
            },
        }
    )

    // auto-scroll feed: seed with more events and keep pushing live ones
    useEffect(() => {
        const el = autoScrollRef.current
        if (!el) return
        const seed: DemoEvent[] = []
        for (let i = 0; i < 20; i++) seed.push(nextEvent())
        el.events = seed

        const id = setInterval(() => {
            el.events = [...el.events, nextEvent()]
        }, 1500)
        return () => clearInterval(id)
    }, [])

    // max-rows feed: seed with events that overflow the cap, then keep pushing
    useEffect(() => {
        const el = maxRowsRef.current
        if (!el) return
        const seed: DemoEvent[] = Array.from({ length: 12 }, () => nextEvent())
        el.events = seed

        const id = setInterval(() => {
            el.events = [...el.events, nextEvent()]
        }, 2000)
        return () => clearInterval(id)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LiveFeed"
                            description="Vertical feed of timestamped events with optional REC indicator and auto-scroll. Set events via the JS events property; newer events appear at the bottom."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — events with levels">
                                {/* @ts-ignore */}
                                <tc-live-feed ref={basicRef} header="// SYSTEM LOG" />
                            </tc-section-card>

                            <tc-section-card title="Recording indicator">
                                {/* @ts-ignore */}
                                <tc-live-feed ref={recordingRef} header="// LIVE FEED" recording />
                            </tc-section-card>

                            <tc-section-card title="Auto-scroll (new events every 1.5 s)">
                                {/* @ts-ignore */}
                                <tc-live-feed
                                    ref={autoScrollRef}
                                    header="// STREAM"
                                    recording
                                    auto-scroll
                                />
                            </tc-section-card>

                            <tc-section-card title="max-rows=5 — oldest trimmed automatically (new events every 2 s)">
                                {/* @ts-ignore */}
                                <tc-live-feed
                                    ref={maxRowsRef}
                                    header="// AUDIT"
                                    max-rows="5"
                                    auto-scroll
                                />
                            </tc-section-card>

                            <tc-section-card title="tc-row-click event — click any row">
                                {/* @ts-ignore */}
                                <tc-live-feed ref={clickRef} header="// EVENTS" />
                                {clickedRow && (
                                    <div className="form-text mt-2 text-success">
                                        ✓ <code>tc-row-click</code> → {clickedRow}
                                    </div>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LiveFeedDemo
