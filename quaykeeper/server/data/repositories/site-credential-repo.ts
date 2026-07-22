// Site source-credential repository — all SQL for the `site_credential` table. One
// optional row per site: the deploy key / token / password / header value its source
// authenticates with, stored ONLY as the AES-256-GCM ciphertext the sites service
// sealed (`infrastructure/cipher.ts`). Like `github-token-repo`, this layer is
// deliberately encryption-blind — it moves opaque `secret_enc` strings; sealing and
// opening live in the service.
//
// A GitHub-sourced site needs no row: it authenticates with the owner's OAuth token
// from `user_github_token`. The row exists only for the sources Quaykeeper can't mint
// a credential for on the user's behalf — a non-GitHub git host, or an archive URL.

import 'server-only'
import { prep, getRow } from '@/server/data/db'

/** Upsert a site's encrypted source credential (a rotation just overwrites it). */
export function set(siteId: string, secretEnc: string, at: string): void {
    prep(
        `INSERT INTO site_credential (site_id, secret_enc, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(site_id) DO UPDATE SET secret_enc = excluded.secret_enc, updated_at = excluded.updated_at`,
    ).run(siteId, secretEnc, at)
}

/** The stored ciphertext for a site, if any. */
export function get(siteId: string): string | undefined {
    return getRow<{ secret_enc: string }>(
        'SELECT secret_enc FROM site_credential WHERE site_id = ?',
        siteId,
    )?.secret_enc
}

/** When a site's credential was last written — the only thing the API reveals about it. */
export function updatedAt(siteId: string): string | undefined {
    return getRow<{ updated_at: string }>(
        'SELECT updated_at FROM site_credential WHERE site_id = ?',
        siteId,
    )?.updated_at
}

/** Drop a site's stored credential (idempotent — a no-op when none is set). */
export function remove(siteId: string): void {
    prep('DELETE FROM site_credential WHERE site_id = ?').run(siteId)
}
