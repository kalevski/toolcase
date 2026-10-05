// Live updates: JMAP EventSource through the gateway (RFC 8620 §7.3), with a
// polling fallback (Mailbox/get + Email state every 30 s, backing off on errors)
// when the stream cannot be kept open. The stream is retried every 5 minutes.

import { useEffect, useRef, useState } from 'react'
import type { JmapClient } from '../api/jmap'
import { getEmailState, getMailboxes } from '../api/mail'
import type { StateChange } from '../jmap/types'

const POLL_BASE = 30_000
const POLL_MAX = 5 * 60_000
const STREAM_RETRY = 5 * 60_000

export function useLiveUpdates(
    jmap: JmapClient,
    onChange: () => void,
): { polling: boolean; pollSeconds: number } {
    const [polling, setPolling] = useState(false)
    const [pollMs, setPollMs] = useState(POLL_BASE)
    const cb = useRef(onChange)
    cb.current = onChange

    useEffect(() => {
        let stopped = false
        let es: EventSource | null = null
        let pollTimer = 0
        let retryTimer = 0
        let interval = POLL_BASE
        let lastState = ''
        let errors = 0
        let opened = false

        const changed = () => {
            if (!stopped) cb.current()
        }

        const poll = async () => {
            if (stopped) return
            try {
                const [mb, emailState] = await Promise.all([getMailboxes(jmap), getEmailState(jmap)])
                const state = `${mb.state}/${emailState}`
                if (lastState && state !== lastState) changed()
                lastState = state
                interval = POLL_BASE
            } catch {
                interval = Math.min(interval * 2, POLL_MAX)
            }
            setPollMs(interval)
            pollTimer = window.setTimeout(poll, document.hidden ? Math.max(interval, 60_000) : interval)
        }

        const startPolling = () => {
            if (stopped || pollTimer) return
            setPolling(true)
            void poll()
            retryTimer = window.setTimeout(() => {
                window.clearTimeout(pollTimer)
                pollTimer = 0
                startStream()
            }, STREAM_RETRY)
        }

        const onState = (ev: MessageEvent) => {
            errors = 0
            try {
                const data = JSON.parse(ev.data) as StateChange
                if (data['@type'] === 'StateChange' || data.changed) {
                    const forUs = data.changed?.[jmap.accountId]
                    if (!forUs || 'Email' in forUs || 'Mailbox' in forUs || 'Thread' in forUs) {
                        changed()
                    }
                }
            } catch {
                // ignore malformed / ping frames
            }
        }

        const startStream = () => {
            if (stopped) return
            if (typeof EventSource === 'undefined' || !jmap.session.eventSourceUrl) {
                startPolling()
                return
            }
            try {
                es = new EventSource(jmap.eventSourceUrl(), { withCredentials: true })
            } catch {
                startPolling()
                return
            }
            es.addEventListener('state', onState as EventListener)
            es.onmessage = onState
            es.onopen = () => {
                errors = 0
                setPolling(false)
                window.clearTimeout(retryTimer)
                // After a reconnect the stream only carries changes from now on;
                // catch up once.
                if (opened) changed()
                opened = true
            }
            es.onerror = () => {
                errors += 1
                if (es && (es.readyState === EventSource.CLOSED || errors >= 3)) {
                    es.close()
                    es = null
                    startPolling()
                }
            }
        }

        startStream()
        return () => {
            stopped = true
            es?.close()
            window.clearTimeout(pollTimer)
            window.clearTimeout(retryTimer)
        }
    }, [jmap])

    return { polling, pollSeconds: Math.round(pollMs / 1000) }
}
