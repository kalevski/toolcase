// Server-Sent Events (spec §4.2): the in-process job event bus + the streaming
// response. Snapshot + replay ring buffer + 25 s keep-alive ping. The ownership
// filter applies AT SEND TIME to both live events and ring-buffer replay — a
// standard user's connection never carries another owner's job ids.

import 'server-only'
import { EventEmitter } from 'node:events'
import type { JobUpdatedEvent } from '@/server/domain/types'

const RING_SIZE = 100

interface Bus {
    emitter: EventEmitter
    ring: JobUpdatedEvent[]
}

declare global {
    var __voxscribeSseBus: Bus | undefined
}

function bus(): Bus {
    if (!globalThis.__voxscribeSseBus) {
        const emitter = new EventEmitter()
        emitter.setMaxListeners(0) // one listener per open SSE connection
        globalThis.__voxscribeSseBus = { emitter, ring: [] }
    }
    return globalThis.__voxscribeSseBus
}

/** Publish a job update (worker + transcriptions service call this). */
export function publishJobUpdate(event: Omit<JobUpdatedEvent, 'type'>): void {
    const b = bus()
    const full: JobUpdatedEvent = { type: 'job.updated', ...event }
    b.ring.push(full)
    if (b.ring.length > RING_SIZE) b.ring.splice(0, b.ring.length - RING_SIZE)
    b.emitter.emit('event', full)
}

function frame(event: unknown): string {
    return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * The SSE response for `GET /api/transcriptions/events`. `visibleTo` is the
 * per-subscriber ownership filter: admins see everything, standard users only
 * their own jobs — enforced here for replay AND live delivery (spec §4.2).
 */
export function sseResponse(visibleTo: (event: JobUpdatedEvent) => boolean): Response {
    const encoder = new TextEncoder()
    let cleanup: (() => void) | null = null

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (event: JobUpdatedEvent, replay = false) => {
                if (!visibleTo(event)) return
                try {
                    controller.enqueue(encoder.encode(frame(replay ? { ...event, replay: true } : event)))
                } catch {
                    /* controller closed */
                }
            }

            // 1) replay the recent ring so late subscribers rebuild state.
            for (const evt of bus().ring) send(evt, true)

            // 2) live subscription.
            const listener = (event: JobUpdatedEvent) => send(event)
            bus().emitter.on('event', listener)

            // keep-alive heartbeat
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'))
                } catch {
                    /* closed */
                }
            }, 25_000)

            cleanup = () => {
                clearInterval(heartbeat)
                bus().emitter.off('event', listener)
            }
        },
        cancel() {
            cleanup?.()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
