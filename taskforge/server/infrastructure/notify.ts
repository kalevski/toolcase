// D2 event-level notifications. Dispatches `{ event, project, payload }` to the
// configured sinks: the existing Slack webhook (formatted text) and a generic
// outbound JSON webhook (ntfy / Discord / home automation). Which events fire is
// resolved per project (E1 settings → env CSV fallback). All sends are
// fire-and-forget — a notification must never wedge the engine.

import 'server-only'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import type { NotifyEvent } from '@/server/domain/types'

export interface NotifyPayload {
    /** One-line human text (Slack line / webhook `text`). */
    text: string
    /** Structured extras forwarded verbatim on the JSON webhook. */
    data?: Record<string, unknown>
}

export interface NotifyTargets {
    /** Events that should fire (from project settings or NOTIFY_EVENTS env). */
    events: string[]
    /** Generic webhook URL (project setting or NOTIFY_WEBHOOK_URL env). */
    webhookUrl: string
}

/** Env-level fallback targets (per-project overrides come from settings.ts). */
export function envTargets(): NotifyTargets {
    return { events: config.notifyEvents, webhookUrl: config.notifyWebhookUrl }
}

async function postJson(url: string, body: unknown): Promise<void> {
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

/**
 * Send `event` for `project` to every configured sink listed in `targets`.
 * Never throws; failures are logged at debug level only.
 */
export function dispatch(project: string, event: NotifyEvent, payload: NotifyPayload, targets: NotifyTargets): void {
    if (!targets.events.includes(event)) return

    if (config.slackWebhookUrl) {
        void postJson(config.slackWebhookUrl, {
            text: `*TaskForge* \`${project}\` — ${payload.text}`,
        }).catch((err) => slog('warn', 'notify', `slack send failed`, { project, event, error: String(err) }))
    }

    if (targets.webhookUrl) {
        void postJson(targets.webhookUrl, {
            event,
            project,
            text: payload.text,
            at: new Date().toISOString(),
            ...payload.data,
        }).catch((err) => slog('warn', 'notify', `webhook send failed`, { project, event, error: String(err) }))
    }
}
