// Backup service (planning §8.7, §11). Takes a consistent SQLite snapshot via
// VACUUM INTO, encrypts the whole file with the current keyring key (AES-256-GCM),
// writes it to BACKUP_DIR, and records a row stamped with the sealing key id.
// A background ticker takes auto-backups on an interval and prunes both old
// backups (BACKUP_RETENTION) and old audit rows (AUDIT_RETENTION_DAYS, gap-3).
// Restore is a documented MANUAL procedure (decision #15) — no in-app route.

import 'server-only'
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { vacuumInto } from '@/server/data/db'
import { sealBytes, currentKeyId } from '@/server/infrastructure/cipher'
import * as backupRepo from '@/server/data/repositories/backup-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { ID } from '@/server/infrastructure/ids'
import type { Backup } from '@/server/domain/types'

export class BackupNotFoundError extends Error {}

function stamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * Take an encrypted snapshot now. `kind` distinguishes ticker auto-backups from manual.
 *
 * PERF / wharf C3: the snapshot path here is fully SYNCHRONOUS on the single shared
 * `DatabaseSync` handle (`vacuumInto` + `readFileSync` + `sealBytes` + `writeFileSync`).
 * Because every repository call is synchronous SQLite on that same handle, a large-DB
 * VACUUM + file read BLOCKS all request serving for its duration. This is acceptable
 * while the DB stays small; the proper fix is SQLite's online backup API or a worker
 * thread (out of scope here — see ensureBackupTickerStarted for the partial mitigation).
 */
export function takeBackup(kind: 'auto' | 'manual', createdBy?: number): Backup {
    mkdirSync(config.backupDir, { recursive: true })
    const id = ID.backup()
    const tmpPath = path.join(config.backupDir, `.${id}.tmp.db`)
    const destPath = path.join(config.backupDir, `wharf-${stamp()}-${id}.db.enc`)

    // 1) consistent plaintext snapshot, 2) seal it, 3) drop the plaintext temp.
    vacuumInto(tmpPath)
    try {
        const sealed = sealBytes(readFileSync(tmpPath))
        writeFileSync(destPath, sealed, { mode: 0o600 })
    } finally {
        rmSync(tmpPath, { force: true })
    }

    const backup: Backup = {
        id,
        path: destPath,
        sizeBytes: statSync(destPath).size,
        encrypted: true,
        kind,
        keyId: currentKeyId(),
        createdAt: new Date().toISOString(),
        createdBy,
    }
    backupRepo.insert(backup)
    pruneBackups()
    return backup
}

/** Keep the newest BACKUP_RETENTION snapshots; delete the rest (files + rows). */
function pruneBackups(): void {
    const all = backupRepo.list() // newest first
    for (const old of all.slice(Math.max(0, config.backupRetention))) {
        rmSync(old.path, { force: true })
        backupRepo.remove(old.id)
    }
}

/** Drop audit rows older than AUDIT_RETENTION_DAYS (gap-3). Returns rows removed. */
export function pruneAuditRetention(): number {
    const cutoff = new Date(Date.now() - config.auditRetentionDays * 86400_000).toISOString()
    return auditRepo.pruneBefore(cutoff)
}

export function listBackups(): Backup[] {
    return backupRepo.list()
}

/** The encrypted blob for download (caller decrypts out-of-band on restore). */
export function getBackupBlob(id: string): { backup: Backup; bytes: Buffer } {
    const backup = backupRepo.byId(id)
    if (!backup || !existsSync(backup.path)) throw new BackupNotFoundError()
    return { backup, bytes: readFileSync(backup.path) }
}

// ── background ticker (booted from instrumentation.ts) ─────────────────────────

declare global {
    var __wharfBackupTicker: ReturnType<typeof setInterval> | undefined
}

/** Start the backup + audit-prune ticker once per process (globalThis-cached). */
export function ensureBackupTickerStarted(): void {
    if (globalThis.__wharfBackupTicker) return
    const everyMs = Math.max(1, config.backupIntervalHours) * 3600_000
    globalThis.__wharfBackupTicker = setInterval(() => {
        // wharf C3 (partial): the synchronous snapshot in takeBackup blocks request
        // serving for its duration — documented there. Here we only guarantee a
        // failure is caught + logged and never throws out of the interval callback
        // (an unhandled throw from a timer would crash the process). A full fix
        // (online-backup API / worker thread) is out of scope.
        try {
            takeBackup('auto')
        } catch (err) {
            // best-effort — never crash the process on a backup failure
            console.error('[wharf] auto-backup failed:', (err as Error).message)
        }
        try {
            pruneAuditRetention()
        } catch {
            /* best-effort */
        }
    }, everyMs)
    // Node: don't keep the event loop alive solely for the ticker.
    globalThis.__wharfBackupTicker.unref?.()
}
