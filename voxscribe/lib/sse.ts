'use client'

// Client SSE hook (spec §4.2): subscribes to /api/transcriptions/events and
// invokes the callback per `job.updated`. Auto-reconnects (EventSource native);
// callers should also re-fetch their list on error — the endpoint is cheap and
// re-fetching is the polling fallback.

import { useEffect, useRef } from 'react'
import type { JobUpdatedEvent } from '@/server/domain/types'

export function useJobEvents(onEvent: (event: JobUpdatedEvent & { replay?: boolean }) => void): void {
    const handler = useRef(onEvent)
    handler.current = onEvent

    useEffect(() => {
        const source = new EventSource('/api/transcriptions/events')
        source.onmessage = (msg) => {
            try {
                const event = JSON.parse(msg.data)
                if (event?.type === 'job.updated') handler.current(event)
            } catch {
                /* malformed frame — ignore */
            }
        }
        return () => source.close()
    }, [])
}
