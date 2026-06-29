// App-setting repository — all SQL for the `app_setting` table (migration v11). A
// generic key/value store backing the owner-editable instance settings (branding).
// Raw-SQL read-all / upsert only; validation and the default merge live in
// `domain/settings.ts` + `services/settings.ts`.

import 'server-only'
import { prep, allRows, tx } from '@/server/data/db'

interface Raw {
    key: string
    value: string
}

/** Every stored setting as a flat key→value map (missing keys simply absent). */
export function getAll(): Record<string, string> {
    const rows = allRows<Raw>('SELECT key, value FROM app_setting')
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    return out
}

/** Upsert one setting (insert or replace the value), stamping `updated_at`. */
export function set(key: string, value: string, updatedAt: string = new Date().toISOString()): void {
    prep(
        `INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(key, value, updatedAt)
}

/** Upsert several settings atomically (one transaction), sharing one `updated_at`. */
export function setMany(entries: Record<string, string>, updatedAt: string = new Date().toISOString()): void {
    tx(() => {
        for (const [key, value] of Object.entries(entries)) set(key, value, updatedAt)
    })
}
