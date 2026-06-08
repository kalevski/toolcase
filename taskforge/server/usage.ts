// Agent usage panel (§ dashboard): run the `claude` client's `/usage` slash
// command on demand, parse its text output, and cache the result to disk.
//
// `/usage` is a local, read-only command (no tokens spent). We never call it on
// page load — only when the dashboard's "Refresh" button POSTs here. The GET
// path serves the last cached snapshot so the panel renders instantly.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config'
import { runAgentOnce } from './agent'
import type { UsageEntry, UsageSnapshot } from './types'

/** On-disk cache for the most recent `/usage` snapshot. */
function cachePath(): string {
    return path.join(config.workspaceDir, '.usage-cache.json')
}

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

/** Read the cached snapshot, or null if none exists / is unreadable. */
export async function readUsageCache(): Promise<UsageSnapshot | null> {
    try {
        const raw = await fs.readFile(cachePath(), 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.entries) && typeof parsed.fetchedAt === 'string') {
            return parsed as UsageSnapshot
        }
    } catch {
        /* no cache yet */
    }
    return null
}

async function writeUsageCache(snapshot: UsageSnapshot): Promise<void> {
    await fs.mkdir(config.workspaceDir, { recursive: true })
    await fs.writeFile(cachePath(), JSON.stringify(snapshot, null, 2), 'utf8')
}

export class UsageError extends Error {}

/**
 * Run `/usage` through the agent, parse it, persist to the cache, and return the
 * fresh snapshot. Throws `UsageError` on timeout or unparseable output.
 */
export async function refreshUsage(now: number): Promise<UsageSnapshot> {
    await fs.mkdir(config.workspaceDir, { recursive: true })

    const res = await runAgentOnce({
        cwd: config.workspaceDir,
        model: config.defaultModel,
        prompt: '/usage',
        timeoutMs: config.generateTimeoutMs,
        // Local slash command → plain text, no streaming/edit flags.
        extraArgs: '--print --output-format=text',
    })

    if (res.timedOut) {
        throw new UsageError('Timed out running /usage')
    }

    const snapshot = parseUsage(res.stdout, new Date(now).toISOString())
    if (snapshot.entries.length === 0) {
        const detail = (res.stderr || res.stdout).trim().slice(0, 200)
        throw new UsageError(detail ? `No usage data in /usage output: ${detail}` : 'No usage data in /usage output')
    }

    await writeUsageCache(snapshot)
    return snapshot
}
