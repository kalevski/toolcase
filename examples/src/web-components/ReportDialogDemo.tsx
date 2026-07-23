import React, { useEffect, useState } from 'react'
import { useTc, useTcEvents } from '@toolcase/web-components/react'

const CUSTOM_REASONS = [
    'Exploiting bugs',
    'Stream sniping',
    'Account sharing',
    'Abusive voice chat',
]

const ReportDialogDemo: React.FC = () => {
    const [basicOpen, setBasicOpen] = useState(false)
    const [customOpen, setCustomOpen] = useState(false)
    const [eventsOpen, setEventsOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog((l) => [msg, ...l].slice(0, 10))

    const basicRef = useTcEvents<HTMLElement>({
        'tc-cancel': () => setBasicOpen(false),
        'tc-submit': (e: CustomEvent) => {
            setBasicOpen(false)
            appendLog(`Submitted — reason: "${e.detail.reason}", comment: "${e.detail.comment}"`)
        },
    })
    const customRef = useTc<HTMLElement>(
        { reasons: CUSTOM_REASONS },
        {
            'tc-cancel': () => setCustomOpen(false),
            'tc-submit': () => setCustomOpen(false),
        }
    )
    const eventsRef = useTcEvents<HTMLElement>({
        'tc-cancel': () => {
            appendLog('tc-cancel fired')
            setEventsOpen(false)
        },
        'tc-submit': (e: CustomEvent) => {
            appendLog(
                `tc-submit — reason: "${e.detail.reason}", comment: "${e.detail.comment || '(none)'}"`,
            )
            setEventsOpen(false)
        },
    })

    // Basic dialog
    useEffect(() => {
        if (!basicRef.current) return
        if (basicOpen) basicRef.current.setAttribute('open', '')
        else basicRef.current.removeAttribute('open')
    }, [basicOpen])

    // Custom reasons dialog
    useEffect(() => {
        if (!customRef.current) return
        if (customOpen) customRef.current.setAttribute('open', '')
        else customRef.current.removeAttribute('open')
    }, [customOpen])

    // Events dialog
    useEffect(() => {
        if (!eventsRef.current) return
        if (eventsOpen) eventsRef.current.setAttribute('open', '')
        else eventsRef.current.removeAttribute('open')
    }, [eventsOpen])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ReportDialog"
                            description="Player-report moderation modal with a reason radio group, optional comment textarea, and Cancel / Submit Report actions. Controlled — fires tc-cancel or tc-submit; the consumer sets open to false to dismiss."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — default reasons, player name">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setBasicOpen(true)}
                                >
                                    Report ShadowStriker99
                                </button>
                                {/* @ts-ignore */}
                                <tc-report-dialog ref={basicRef} player-name="ShadowStriker99" />
                            </tc-section-card>

                            <tc-section-card title="Custom reasons — injected via JS property">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setCustomOpen(true)}
                                >
                                    Report NightRaider
                                </button>
                                {/* @ts-ignore */}
                                <tc-report-dialog ref={customRef} player-name="NightRaider" />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-cancel / tc-submit">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setEventsOpen(true)}
                                >
                                    Open event demo
                                </button>
                                {/* @ts-ignore */}
                                <tc-report-dialog ref={eventsRef} player-name="EventTarget42" />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Open the dialog, pick a reason, and interact…
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReportDialogDemo
