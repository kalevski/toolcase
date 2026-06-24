// Agent usage panel (§ dashboard): run the `claude` client's `/usage` slash
// command on demand, parse its text output, and cache the result to disk.
//
// `/usage` is a local, read-only command (no tokens spent). We never call it on
// page load — only when the dashboard's "Refresh" button POSTs here. The GET
// path serves the last cached snapshot so the panel renders instantly.

import 'server-only'
import { config } from '@/server/config'
import { runAgentOnce } from '@/server/infrastructure/agent'
import { saveSnapshot, latest as latestSnapshot } from '@/server/data/repositories/usage-repo'
import { resolveAccount } from '@/server/services/accounts'
import { ensureImported } from '@/server/services/migrate-fs'
import type { UsageEntry, UsageSnapshot } from '@/server/domain/types'

// Matches lines like:
//   "Current session: 37% used · resets Jun 9 at 1:40am (Europe/Skopje)"
//   "Current week (all models): 42% used"
const ENTRY_RE = /^(.+?):\s*(\d+)%\s*used\s*(?:[·•-]\s*resets\s*(.+?))?\s*$/i

/** Parse the raw `/usage` text into a structured snapshot. */
export function parseUsage(raw: string, fetchedAt: string): UsageSnapshot {
    const entries: UsageEntry[] = []
    let note = ''
    for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const m = trimmed.match(ENTRY_RE)
        if (m) {
            entries.push({
                label: m[1].trim(),
                percent: Math.max(0, Math.min(100, Number(m[2]))),
                resets: m[3]?.trim() || undefined,
            })
        } else if (!note) {
            // First non-entry prose line is the subscription / API-credit note.
            note = trimmed
        }
    }
    return { fetchedAt, note, entries, raw: raw.trim() }
}

/**
 * Read the most recent cached snapshot from SQLite, or null if none exists.
 * `account` selects which Claude identity's cache to read (null = the ambient
 * host login).
 */
export async function readUsageCache(account: string | null = null): Promise<UsageSnapshot | null> {
    await ensureImported()
    return latestSnapshot(account)
}

export class UsageError extends Error {}

/**
 * Run `/usage` through the agent, parse it, persist the snapshot, and return it.
 * When `account` is given, `/usage` runs under that registry identity's env
 * (CLAUDE_CONFIG_DIR / API key) and the snapshot is cached against that alias;
 * null = the ambient host login. Throws `UsageError` on timeout, an
 * unresolvable account, or unparseable output.
 */
export async function refreshUsage(now: number, account: string | null = null): Promise<UsageSnapshot> {
    let accountEnv: Record<string, string> | undefined
    if (account) {
        try {
            accountEnv = resolveAccount(account).env
        } catch (err) {
            throw new UsageError(`account "${account}" could not be resolved: ${(err as Error)?.message ?? err}`)
        }
    }

    const res = await runAgentOnce({
        cwd: config.workspaceDir,
        model: config.defaultModel,
        prompt: '/usage',
        timeoutMs: config.generateTimeoutMs,
        // Local slash command → plain text, no streaming/edit flags.
        extraArgs: '--print --output-format=text',
        accountEnv,
    })

    if (res.timedOut) {
        throw new UsageError('Timed out running /usage')
    }

    const snapshot = parseUsage(res.stdout, new Date(now).toISOString())
    if (snapshot.entries.length === 0) {
        const detail = (res.stderr || res.stdout).trim().slice(0, 200)
        throw new UsageError(detail ? `No usage data in /usage output: ${detail}` : 'No usage data in /usage output')
    }

    saveSnapshot(snapshot, account)
    return snapshot
}
