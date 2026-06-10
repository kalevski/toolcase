// Shared parser for the agent CLI's `--output-format=stream-json` NDJSON
// stream. Single source of truth for the `system` / `assistant` / `result`
// event shapes, used by both the execution engine (per-task runs) and the
// one-shot agent session manager.

import 'server-only'

/** B2 — token/cost usage extracted from the final `result` frame. */
export interface AgentUsage {
    tokensIn: number
    tokensOut: number
    costUsd: number | null
}

export interface AgentStreamHandlers {
    /** Assistant text block. */
    onText: (text: string) => void
    /** Assistant tool_use block (tool name only). */
    onToolUse: (name: string) => void
    /** Final `result` frame. */
    onResult: (result: { isError: boolean; text: string; usage: AgentUsage | null }) => void
    /** First observed session id. */
    onSessionId: (id: string) => void
    /** A stdout line that is not valid JSON (surfaced verbatim). */
    onRaw: (line: string) => void
}

export interface AgentStreamParser {
    /** Feed a stdout chunk; complete lines are dispatched, the remainder buffered. */
    feed: (chunk: string) => void
    /** Flush the trailing unterminated line (call on process close). */
    flush: () => void
}

/**
 * B2 — pull `usage` + `total_cost_usd` out of the final `result` frame.
 * `tokensIn` sums fresh input with cache reads/writes (what the request fed the
 * model); absent/malformed fields degrade to null rather than throwing.
 */
function extractUsage(evt: any): AgentUsage | null {
    const u = evt?.usage
    const cost = typeof evt?.total_cost_usd === 'number' ? evt.total_cost_usd : null
    if (!u && cost === null) return null
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return {
        tokensIn: n(u?.input_tokens) + n(u?.cache_read_input_tokens) + n(u?.cache_creation_input_tokens),
        tokensOut: n(u?.output_tokens),
        costUsd: cost,
    }
}

export function createAgentStreamParser(handlers: AgentStreamHandlers): AgentStreamParser {
    let remainder = ''
    let sessionId: string | undefined

    const captureSession = (id: unknown) => {
        if (typeof id === 'string' && id && !sessionId) {
            sessionId = id
            handlers.onSessionId(id)
        }
    }

    const handleLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        let evt: any
        try {
            evt = JSON.parse(trimmed)
        } catch {
            handlers.onRaw(line)
            return
        }
        captureSession(evt.session_id)
        switch (evt.type) {
            case 'system':
                if (evt.subtype === 'init') captureSession(evt.session_id)
                break
            case 'assistant': {
                const content = evt.message?.content ?? []
                for (const block of content) {
                    if (block.type === 'text' && block.text) {
                        handlers.onText(block.text)
                    } else if (block.type === 'tool_use') {
                        handlers.onToolUse(block.name ?? 'tool')
                    }
                }
                break
            }
            case 'result':
                handlers.onResult({
                    isError: evt.is_error === true,
                    text: typeof evt.result === 'string' ? evt.result : '',
                    usage: extractUsage(evt),
                })
                break
            default:
                break
        }
    }

    return {
        feed(chunk: string) {
            const text = remainder + chunk
            const lines = text.split('\n')
            remainder = lines.pop() ?? ''
            for (const line of lines) handleLine(line)
        },
        flush() {
            if (remainder.trim()) handleLine(remainder)
            remainder = ''
        },
    }
}
