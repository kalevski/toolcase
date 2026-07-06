// GitHub-token repository — all SQL for the `user_github_token` table (v14). One
// row per user: their GitHub OAuth access token, stored ONLY as the AES-256-GCM
// ciphertext the auth service sealed (`infrastructure/cipher.ts`). This repo is
// deliberately encryption-blind — it moves opaque `token_enc` strings; sealing
// and opening live in `services/auth.ts`, mirroring how the realm repo stores
// the encrypted nginxpilot admin token.

import 'server-only'
import { prep, getRow } from '@/server/data/db'

/** Upsert a user's encrypted GitHub token (refreshed on every login). */
export function set(githubId: number, tokenEnc: string, at: string): void {
    prep(
        `INSERT INTO user_github_token (github_id, token_enc, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(github_id) DO UPDATE SET token_enc = excluded.token_enc, updated_at = excluded.updated_at`,
    ).run(githubId, tokenEnc, at)
}

/** The stored ciphertext for a user, if any. */
export function get(githubId: number): string | undefined {
    return getRow<{ token_enc: string }>(
        'SELECT token_enc FROM user_github_token WHERE github_id = ?',
        githubId,
    )?.token_enc
}

/** Drop a user's stored token. */
export function remove(githubId: number): void {
    prep('DELETE FROM user_github_token WHERE github_id = ?').run(githubId)
}
