// Orphaned-artifact sweep (spec §6.5): daily + on boot, deletes media
// directories and note `.md` files older than 24 h with no matching DB row,
// plus stale `.md.tmp` leftovers from crashed note updates. Orphans can only
// arise from a crash between file write and row insert (both create flows
// write the file before the row); the age threshold keeps the sweep from
// racing an in-flight upload.

import 'server-only'
import fsp from 'node:fs/promises'
import path from 'node:path'
import * as trnRepo from '@/server/data/repositories/transcription-repo'
import * as noteRepo from '@/server/data/repositories/note-repo'
import { mediaRoot, notesRoot } from '@/server/infrastructure/fs-media'
import { slog } from '@/server/infrastructure/server-log'

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000
const MIN_AGE_MS = 24 * 60 * 60 * 1000

declare global {
    var __voxscribeSweep: { timer: NodeJS.Timeout | null } | undefined
}

function state() {
    if (!globalThis.__voxscribeSweep) globalThis.__voxscribeSweep = { timer: null }
    return globalThis.__voxscribeSweep
}

async function olderThan(p: string, cutoffMs: number): Promise<boolean> {
    try {
        const stat = await fsp.stat(p)
        return stat.mtimeMs < cutoffMs
    } catch {
        return false
    }
}

/** One sweep pass. Exported for tests. */
export async function sweepOnce(): Promise<{ removed: number }> {
    const cutoff = Date.now() - MIN_AGE_MS
    let removed = 0

    // Orphaned media directories: media/<id>/ with no transcription row.
    try {
        const known = trnRepo.allIds()
        const entries = await fsp.readdir(mediaRoot(), { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
            if (!entry.isDirectory() || !/^trn_[0-9a-z]+$/.test(entry.name)) continue
            if (known.has(entry.name)) continue
            const dir = path.join(mediaRoot(), entry.name)
            if (await olderThan(dir, cutoff)) {
                await fsp.rm(dir, { recursive: true, force: true })
                removed++
                slog('warn', 'sweep', `removed orphaned media dir ${entry.name}`)
            }
        }
    } catch (err) {
        slog('error', 'sweep', `media sweep failed: ${err instanceof Error ? err.message : err}`)
    }

    // Orphaned note files + stale update temp files.
    try {
        const known = noteRepo.allIds()
        const entries = await fsp.readdir(notesRoot(), { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
            if (!entry.isFile()) continue
            const file = path.join(notesRoot(), entry.name)
            const tmpMatch = entry.name.match(/^(nte_[0-9a-z]+)\.md\.tmp$/)
            const mdMatch = entry.name.match(/^(nte_[0-9a-z]+)\.md$/)
            if (tmpMatch) {
                if (await olderThan(file, cutoff)) {
                    await fsp.rm(file, { force: true })
                    removed++
                    slog('warn', 'sweep', `removed stale note temp ${entry.name}`)
                }
            } else if (mdMatch && !known.has(mdMatch[1])) {
                if (await olderThan(file, cutoff)) {
                    await fsp.rm(file, { force: true })
                    removed++
                    slog('warn', 'sweep', `removed orphaned note file ${entry.name}`)
                }
            }
        }
    } catch (err) {
        slog('error', 'sweep', `notes sweep failed: ${err instanceof Error ? err.message : err}`)
    }

    return { removed }
}

export function ensureSweepStarted(): void {
    const s = state()
    if (s.timer) return
    // On boot + daily.
    void sweepOnce().catch(() => {})
    s.timer = setInterval(() => {
        void sweepOnce().catch(() => {})
    }, SWEEP_INTERVAL_MS)
    s.timer.unref()
}
