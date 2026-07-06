// Saved git SSH keys — all SQL for the `git_key` table. Registry metadata only:
// the private key material is an owner-only file under `config.gitKeysDir`
// (written by services/git-keys.ts) and deliberately has no column here — the
// same secret discipline as the `account` table.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import { GIT_KEY_ALIAS_RE } from '@/server/domain/git-keys'
import type { GitKey } from '@/server/domain/types'

export class InvalidGitKeyError extends Error {}

interface Raw {
    alias: string
    label: string | null
    created_at: string
}

function map(r: Raw): GitKey {
    return { alias: r.alias, label: r.label ?? undefined, createdAt: r.created_at }
}

export function validateAlias(alias: string): void {
    if (!GIT_KEY_ALIAS_RE.test(alias)) {
        throw new InvalidGitKeyError('alias must be kebab-case (a-z, 0-9, dashes), 1–41 chars')
    }
}

export function insert(alias: string, label: string | undefined, createdAt: string): GitKey {
    validateAlias(alias)
    prep('INSERT INTO git_key (alias, label, created_at) VALUES (?, ?, ?)').run(
        alias,
        label?.trim() || null,
        createdAt,
    )
    return get(alias)!
}

export function get(alias: string): GitKey | null {
    const r = getRow<Raw>('SELECT * FROM git_key WHERE alias = ?', alias)
    return r ? map(r) : null
}

export function list(): GitKey[] {
    return allRows<Raw>('SELECT * FROM git_key ORDER BY alias').map(map)
}

export function remove(alias: string): void {
    prep('DELETE FROM git_key WHERE alias = ?').run(alias)
}
