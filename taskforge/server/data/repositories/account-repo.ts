// Claude account registry — all SQL for the `account` table (multi-account
// foundation). Registry metadata only: the API key for `apikey` accounts is
// referenced by env-var name (`api_key_env`) and resolved at spawn time; the
// key value is never stored here.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import { config } from '@/server/config'
import type { Account } from '@/server/domain/types'

const ALIAS_RE = /^[a-z0-9][a-z0-9-]{0,40}$/
const AUTHS = new Set<Account['auth']>(['oauth', 'apikey'])

export class InvalidAccountError extends Error {}

/** Upsert input — `dir` defaults to the conventional per-alias config dir, and
 * the mutable runtime fields are managed by the dispatcher, not callers. */
export type AccountInput = Omit<Account, 'dir' | 'lastUsedAt' | 'coolingUntil'> & { dir?: string }

interface Raw {
    alias: string
    dir: string
    auth: string
    label: string | null
    api_key_env: string | null
    last_used_at: string | null
    cooling_until: string | null
}

function map(r: Raw): Account {
    return {
        alias: r.alias,
        dir: r.dir,
        auth: r.auth as Account['auth'],
        label: r.label ?? undefined,
        apiKeyEnv: r.api_key_env ?? undefined,
        lastUsedAt: r.last_used_at ?? undefined,
        coolingUntil: r.cooling_until ?? undefined,
    }
}

/** The conventional isolated config dir for an alias (`${accountsDir}/<alias>`). */
export function defaultDir(alias: string): string {
    return `${config.accountsDir}/${alias}`
}

export function validate(input: AccountInput): void {
    if (!ALIAS_RE.test(input.alias)) {
        throw new InvalidAccountError('alias must be kebab-case (a-z, 0-9, dashes), 1–41 chars')
    }
    if (!AUTHS.has(input.auth)) {
        throw new InvalidAccountError(`auth must be oauth|apikey (got: ${input.auth})`)
    }
    if (input.auth === 'apikey' && !input.apiKeyEnv?.trim()) {
        throw new InvalidAccountError('apiKeyEnv (env var name) is required for apikey accounts')
    }
}

export function upsert(input: AccountInput): Account {
    validate(input)
    const dir = input.dir?.trim() || defaultDir(input.alias)
    const label = input.label?.trim() || null
    const apiKeyEnv = input.auth === 'apikey' ? input.apiKeyEnv!.trim() : null
    prep(
        `INSERT INTO account (alias, dir, auth, label, api_key_env)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(alias) DO UPDATE SET
            dir = excluded.dir,
            auth = excluded.auth,
            label = excluded.label,
            api_key_env = excluded.api_key_env`,
    ).run(input.alias, dir, input.auth, label, apiKeyEnv)
    return get(input.alias)!
}

export function get(alias: string): Account | null {
    const r = getRow<Raw>('SELECT * FROM account WHERE alias = ?', alias)
    return r ? map(r) : null
}

export function list(): Account[] {
    return allRows<Raw>('SELECT * FROM account ORDER BY alias').map(map)
}

export function remove(alias: string): void {
    prep('DELETE FROM account WHERE alias = ?').run(alias)
}
