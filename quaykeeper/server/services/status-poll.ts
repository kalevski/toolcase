// Scheduled resource-state poller (quaykeeper_better.md B1). NPM writes nginx errors onto
// the host row; Quaykeeper does strictly better — it PERSISTS per-resource state episodes
// with attribution. Each pass reads every realm's `GET /status` once, collects the
// non-active managed-mode resources (`disabled` — quarantined by nginx -t — and
// `at_risk` — the reconcile loop's live-but-would-fail verdict) plus any cert whose
// renewal scheduler reports a sticky failure, and diffs them against the OPEN
// episodes in `resource_state` (the pure `domain/resource-state.ts` differ). Only
// transitions are written: open (with the most recent audit actor for the key —
// "failing since Tue, last changed by @login"), refresh, close. Episodes survive
// daemon AND quaykeeper restarts — including the daemon's in-memory cert-job errors.
//
// Same globalThis-singleton, dev-hot-reload-safe ticker shape as
// `services/quota-sweep.ts`. No external cron; the single-process app makes it safe.

import 'server-only'
import * as realmRepo from '@/server/data/repositories/realm-repo'
import * as stateRepo from '@/server/data/repositories/resource-state-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as realms from '@/server/services/realms'
import { diffEpisodes, type LiveBadState } from '@/server/domain/resource-state'
import { tx } from '@/server/data/db'
import { slog } from '@/server/infrastructure/server-log'

/** Poll cadence — 60s tracks the daemon's reconcile loop closely without hammering it. */
const POLL_INTERVAL_MS = 60_000

/**
 * Audit retention (B3): entries older than `QUAYKEEPER_AUDIT_RETENTION_DAYS` days are
 * pruned on this ticker. 0 / unset = keep forever (the default — the log is the
 * attribution source for everything else).
 */
const AUDIT_RETENTION_DAYS = (() => {
    const raw = Number(process.env.QUAYKEEPER_AUDIT_RETENTION_DAYS)
    return Number.isFinite(raw) && raw > 0 ? raw : 0
})()

/** Prune audit entries past the retention horizon (no-op when retention is off). */
function pruneAudit(): void {
    if (!AUDIT_RETENTION_DAYS) return
    const horizon = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86_400_000).toISOString()
    const removed = auditRepo.prune(horizon)
    if (removed > 0) slog('info', 'status-poll', 'audit entries pruned', { removed, horizon })
}

declare global {
    var __quaykeeperStatusPoll: { timer: ReturnType<typeof setInterval> } | undefined
}

/** Collect one realm's current non-active resources (nginx states + cert failures). */
async function collectBadStates(realmId: string): Promise<LiveBadState[]> {
    const client = realms.clientFor(realmId)
    const bad: LiveBadState[] = []

    const status = await client.status()
    for (const r of status.nginx?.resources ?? []) {
        if (r.state === 'active') continue
        bad.push({ kind: r.kind, key: r.key, state: r.state, reason: r.reason, since: r.since })
    }

    // Cert renewal failures are sticky on the daemon only until ITS restart; recording
    // them as episodes is what makes them durable (better.md §9's lost-on-restart point).
    // Best-effort — a cert-dir-less daemon answering an error must not fail the poll.
    try {
        for (const cert of await client.listCertificates()) {
            if (cert.last_renew_error) {
                bad.push({ kind: 'cert', key: cert.domain, state: 'renew_failed', reason: cert.last_renew_error })
            }
        }
    } catch {
        // /certs unavailable (no cert dir) — nginx states still recorded.
    }
    return bad
}

/**
 * Run one poll pass now: per realm, diff the live non-active set against the open
 * episodes and write the transitions. A per-realm failure is logged and skipped so
 * one unreachable instance can't stall the rest. Returns counts for logs/tests.
 */
export async function pollNow(): Promise<{ realms: number; opened: number; closed: number; failed: number }> {
    let opened = 0
    let closed = 0
    let failed = 0
    const all = realmRepo.list()
    for (const realm of all) {
        try {
            const live = await collectBadStates(realm.id)
            const transitions = diffEpisodes(live, stateRepo.openEpisodes(realm.id))
            if (!transitions.open.length && !transitions.close.length && !transitions.refresh.length) continue
            const at = new Date().toISOString()
            tx(() => {
                for (const id of transitions.close) stateRepo.closeEpisode(id, at)
                for (const t of transitions.refresh) stateRepo.touchEpisode(t.id, at, t.reason)
                for (const l of transitions.open) {
                    // Attribution: the most recent audit mutation naming this key —
                    // denormalized here so it survives audit pruning.
                    const actor = auditRepo.lastActorFor(l.key)
                    stateRepo.openEpisode({
                        realmId: realm.id,
                        kind: l.kind,
                        key: l.key,
                        state: l.state,
                        reason: l.reason,
                        since: l.since,
                        at,
                        actorLogin: actor?.login ?? null,
                        actorAction: actor?.action ?? null,
                        actorAt: actor?.at ?? null,
                    })
                }
            })
            opened += transitions.open.length
            closed += transitions.close.length
            if (transitions.open.length || transitions.close.length) {
                slog('info', 'status-poll', 'episodes updated', {
                    realm: realm.id,
                    opened: transitions.open.length,
                    closed: transitions.close.length,
                })
            }
        } catch (err) {
            failed++
            slog('warn', 'status-poll', 'realm poll failed', { realm: realm.id, error: String(err) })
        }
    }
    pruneAudit()
    return { realms: all.length, opened, closed, failed }
}

/** Idempotent: starts the status-poll ticker once per process. */
export function ensureStatusPollStarted(): void {
    if (globalThis.__quaykeeperStatusPoll) return
    const timer = setInterval(() => {
        void pollNow().catch((err) => slog('error', 'status-poll', 'poll failed', { error: String(err) }))
    }, POLL_INTERVAL_MS)
    // Don't keep the process alive solely for the ticker.
    timer.unref?.()
    globalThis.__quaykeeperStatusPoll = { timer }
    slog('info', 'status-poll', 'ticker started', { intervalMs: POLL_INTERVAL_MS })
}
