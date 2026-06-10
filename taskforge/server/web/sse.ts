// Server-Sent Events helpers (§6.12). Streams engine + agent-session events for
// one repo, replaying the ring buffers + fresh snapshots to late subscribers.

import 'server-only'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import type { SseEvent } from '@/server/domain/types'

function frame(event: SseEvent | { type: string; [k: string]: unknown }): string {
    return `data: ${JSON.stringify(event)}\n\n`
}

export function sseResponse(repo: string): Response {
    const encoder = new TextEncoder()
    let cleanup: (() => void) | null = null

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (event: SseEvent | { type: string; [k: string]: unknown }) => {
                try {
                    controller.enqueue(encoder.encode(frame(event)))
                } catch {
                    /* controller closed */
                }
            }

            // 1) engine snapshot
            const snap = engine.snapshot(repo)
            send({ type: 'state', state: snap.state })
            send({ type: 'progress', done: snap.done, error: snap.error, total: snap.total })
            if (snap.state === 'SLEEPING' && snap.wakeAt) {
                send({ type: 'limit', wakeAt: snap.wakeAt, taskId: snap.current })
            }

            // 2) replay recent engine log frames — tagged `replay` so the client
            //    rebuilds scrollback/state without re-firing ephemeral toasts.
            for (const evt of engine.ring(repo)) send({ ...evt, replay: true })

            // 3) agent-session snapshots + scrollback replay (same `replay` rule)
            for (const agentSnap of agentSessions.snapshots(repo)) {
                send({
                    type: 'agent:state',
                    agent: agentSnap.agent,
                    status: agentSnap.status,
                    startedAt: agentSnap.startedAt,
                    model: agentSnap.model,
                    replay: true,
                })
                for (const evt of agentSessions.ring(repo, agentSnap.agent)) send({ ...evt, replay: true })
            }

            // 4) live subscriptions (engine + agent sessions emit the same shape)
            const listener = (eventRepo: string, event: SseEvent) => {
                if (eventRepo === repo) send(event)
            }
            engine.on('event', listener)
            agentSessions.on('event', listener)

            // keep-alive heartbeat
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'))
                } catch {
                    /* closed */
                }
            }, 25000)

            // teardown when the client disconnects
            cleanup = () => {
                clearInterval(heartbeat)
                engine.off('event', listener)
                agentSessions.off('event', listener)
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
