// Instance-branding storage — the app-level settings live as rows in the generic
// `meta` KV table (key TEXT PRIMARY KEY, value TEXT). Distinct from the per-project
// `project_setting` table (settings-repo.ts). Values are raw strings; (de)coding +
// validation live in `domain/site-settings.ts`.

import 'server-only'
import { allRows, prep, tx } from '@/server/data/db'

/** Read every `meta` row as a key→value map (the decoder filters to known keys). */
export function getAll(): Record<string, string> {
    const rows = allRows<{ key: string; value: string }>('SELECT key, value FROM meta')
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    return out
}

/** Upsert several `meta` rows atomically (used by the settings save). */
export function setMany(entries: Record<string, string>): void {
    tx(() => {
        const up = prep(
            `INSERT INTO meta (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        for (const [key, value] of Object.entries(entries)) up.run(key, value)
    })
}
