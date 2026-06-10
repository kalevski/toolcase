// E1 per-project settings — all SQL for the `project_setting` KV table.
// Values are JSON-encoded so booleans/numbers/arrays round-trip typed.

import 'server-only'
import { prep, allRows, tx } from '@/server/data/db'
import type { ProjectSettings } from '@/server/domain/types'

const KNOWN_KEYS: (keyof ProjectSettings)[] = [
    'defaultModel',
    'commitAfter',
    'commitMessageMode',
    'commitModel',
    'warmSession',
    'knowledgeAutoUpdate',
    'usageGateThreshold',
    'pushAfter',
    'branchPerRun',
    'review',
    'openPr',
    'notifyEvents',
    'notifyWebhookUrl',
]

export function getSettings(project: string): ProjectSettings {
    const rows = allRows<{ key: string; value: string }>(
        'SELECT key, value FROM project_setting WHERE project = ?',
        project,
    )
    const out: Record<string, unknown> = {}
    for (const r of rows) {
        if (!KNOWN_KEYS.includes(r.key as keyof ProjectSettings)) continue
        try {
            out[r.key] = JSON.parse(r.value)
        } catch {
            /* skip corrupt value */
        }
    }
    return out as ProjectSettings
}

/**
 * Replace the project's overrides with `settings`: known keys with defined
 * values are upserted, keys set to undefined/null are deleted (fall back to env).
 */
export function saveSettings(project: string, settings: ProjectSettings): void {
    tx(() => {
        const up = prep(
            `INSERT INTO project_setting (project, key, value) VALUES (?, ?, ?)
             ON CONFLICT(project, key) DO UPDATE SET value = excluded.value`,
        )
        const del = prep('DELETE FROM project_setting WHERE project = ? AND key = ?')
        for (const key of KNOWN_KEYS) {
            const value = (settings as Record<string, unknown>)[key]
            if (value === undefined || value === null || value === '') {
                del.run(project, key)
            } else {
                up.run(project, key, JSON.stringify(value))
            }
        }
    })
}

export function deleteSettings(project: string): void {
    prep('DELETE FROM project_setting WHERE project = ?').run(project)
}
