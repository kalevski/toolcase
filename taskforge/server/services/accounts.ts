// Claude account registry — resolution layer over the `account` table
// (multi-account foundation). Consumers read accounts and resolve an alias to
// the env needed to spawn the `claude` CLI under that identity. This module
// owns the secret boundary: the API key is read from `process.env[apiKeyEnv]`
// only here, at resolution time, and never persisted.

import 'server-only'
import * as accountRepo from '@/server/data/repositories/account-repo'
import type { Account } from '@/server/domain/types'

/** Unknown alias passed to `resolveAccount`. */
export class UnknownAccountError extends Error {
    constructor(alias: string) {
        super(`unknown account alias: "${alias}"`)
    }
}

/** An `apikey` account whose referenced env var is unset/empty at spawn time. */
export class MissingApiKeyError extends Error {
    constructor(alias: string, envVar: string) {
        super(
            `account "${alias}" needs API key env var "${envVar}", but it is not set ` +
                `(set ${envVar} in the environment, or re-add the account with the correct env-var name)`,
        )
    }
}

/** All registered accounts (alias-sorted). */
export function listAccounts(): Account[] {
    return accountRepo.list()
}

/** One account by alias, or null when absent. */
export function getAccount(alias: string): Account | null {
    return accountRepo.get(alias)
}

/**
 * Resolve an alias to the spawn inputs for the `claude` CLI:
 * `dir` (its `CLAUDE_CONFIG_DIR`) and `env` (the env overlay to merge into the
 * child process). For `apikey` accounts the env includes `ANTHROPIC_API_KEY`,
 * read from `process.env[apiKeyEnv]`. Throws for an unknown alias or a missing
 * key env var.
 */
export function resolveAccount(alias: string): { dir: string; env: Record<string, string> } {
    const account = accountRepo.get(alias)
    if (!account) throw new UnknownAccountError(alias)

    const env: Record<string, string> = { CLAUDE_CONFIG_DIR: account.dir }
    if (account.auth === 'apikey') {
        const envVar = account.apiKeyEnv
        if (!envVar) throw new MissingApiKeyError(account.alias, '(none configured)')
        const key = process.env[envVar]
        if (!key || key.trim() === '') throw new MissingApiKeyError(account.alias, envVar)
        env.ANTHROPIC_API_KEY = key
    }
    return { dir: account.dir, env }
}
