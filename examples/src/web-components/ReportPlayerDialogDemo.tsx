import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CUSTOM_REASONS = [
    'Exploiting bugs',
    'Stream sniping',
    'Account sharing',
    'Abusive voice chat',
]

const ReportPlayerDialogDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const customRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [basicOpen, setBasicOpen] = useState(false)
    const [customOpen, setCustomOpen] = useState(false)
    const [eventsOpen, setEventsOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog(l => [msg, ...l].slice(0, 10))

    // Basic dialog
    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        const onCancel = () => setBasicOpen(false)
        const onSubmit = (e: CustomEvent) => {
            setBasicOpen(false)
            appendLog(`Submitted — reason: "${e.detail.reason}", comment: "${e.detail.comment}"`)
        }
        el.addEventListener('tc-cancel', onCancel)
        el.addEventListener('tc-submit', onSubmit as EventListener)
        return () => {
            el.removeEventListener('tc-cancel', onCancel)
            el.removeEventListener('tc-submit', onSubmit as EventListener)
        }
    }, [])

    useEffect(() => {
        if (!basicRef.current) return
        if (basicOpen) basicRef.current.setAttribute('open', '')
        else basicRef.current.removeAttribute('open')
    }, [basicOpen])

    // Custom reasons dialog
    useEffect(() => {
        const el = customRef.current
        if (!el) return
        el.reasons = CUSTOM_REASONS
        const onCancel = () => setCustomOpen(false)
        const onSubmit = () => setCustomOpen(false)
        el.addEventListener('tc-cancel', onCancel)
        el.addEventListener('tc-submit', onSubmit)
        return () => {
            el.removeEventListener('tc-cancel', onCancel)
            el.removeEventListener('tc-submit', onSubmit)
        }
    }, [])

    useEffect(() => {
        if (!customRef.current) return
        if (customOpen) customRef.current.setAttribute('open', '')
        else customRef.current.removeAttribute('open')
    }, [customOpen])

    // Events dialog
    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        const onCancel = () => { appendLog('tc-cancel fired'); setEventsOpen(false) }
        const onSubmit = (e: CustomEvent) => {
            appendLog(`tc-submit — reason: "${e.detail.reason}", comment: "${e.detail.comment || '(none)'}"`)
            setEventsOpen(false)
        }
        el.addEventListener('tc-cancel', onCancel)
        el.addEventListener('tc-submit', onSubmit as EventListener)
        return () => {
            el.removeEventListener('tc-cancel', onCancel)
            el.removeEventListener('tc-submit', onSubmit as EventListener)
        }
    }, [])

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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ReportPlayerDialog"
                            description="Player-report moderation modal with a reason radio group, optional comment textarea, and Cancel / Submit Report actions. Controlled — fires tc-cancel or tc-submit; the consumer sets open to false to dismiss."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic — default reasons, player name">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setBasicOpen(true)}
                                >
                                    Report ShadowStriker99
                                </button>
                                {/* @ts-ignore */}
                                <tc-report-player-dialog
                                    ref={basicRef}
                                    player-name="ShadowStriker99"
                                />
                            </SectionCard>

                            <SectionCard title="Custom reasons — injected via JS property">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setCustomOpen(true)}
                                >
                                    Report NightRaider
                                </button>
                                {/* @ts-ignore */}
                                <tc-report-player-dialog
                                    ref={customRef}
                                    player-name="NightRaider"
                                />
                            </SectionCard>

                            <SectionCard title="Events — tc-cancel / tc-submit">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setEventsOpen(true)}
                                >
                                    Open event demo
                                </button>
                                {/* @ts-ignore */}
                                <tc-report-player-dialog
                                    ref={eventsRef}
                                    player-name="EventTarget42"
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Open the dialog, pick a reason, and interact…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReportPlayerDialogDemo
