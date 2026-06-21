// Claude account registry — resolution layer over the `account` table
// (multi-account foundation). Consumers read accounts and resolve an alias to
// the env needed to spawn the `claude` CLI under that identity. This module
// owns the secret boundary: the API key is read from `process.env[apiKeyEnv]`
// only here, at resolution time, and never persisted.

import 'server-only'
import { config } from '@/server/config'
import * as accountRepo from '@/server/data/repositories/account-repo'
import { runAgentOnce } from '@/server/infrastructure/agent'
import type { Account, AccountHealth } from '@/server/domain/types'

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
 * Spread subscription load across identities: when no specific alias is pinned,
 * pick the least-recently-used eligible account so concurrent project engines
 * rotate rather than hammering one. Eligible = not currently cooling down;
 * optionally restrict rotation to an explicit `pool` of aliases and/or a single
 * `auth` method. The chosen account is stamped `lastUsedAt = now` (via
 * `account-repo`), so repeated calls advance through the pool. Returns `null`
 * when no eligible account remains (including an empty `pool`).
 *
 * Selection + stamp are a single atomic transaction (see
 * `account-repo.pickLeastRecentlyUsed`), so two engines never grab the same
 * account in a race. This is the rotation primitive consumed by the failover
 * path; it does not itself mark accounts cooling down.
 */
export function pickAccount(opts?: { pool?: string[]; auth?: 'oauth' | 'apikey' }): Account | null {
    return accountRepo.pickLeastRecentlyUsed(opts)
}

/**
 * Mark an account cooling down until `until` (ISO-8601) after an attempt under it
 * hit a usage-limit/429, so `pickAccount` skips it until the limit resets (an
 * `until` already in the past leaves it immediately eligible again). The
 * dispatcher calls this on a limit outcome before attempting failover to another
 * identity. No-op for an unknown alias.
 */
export function coolDownAccount(alias: string, until: string): void {
    accountRepo.setCoolingUntil(alias, until)
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

// Heuristic markers of an auth failure in agent stderr — an expired/revoked
// token or unset credentials can surface as a clean-ish exit with a complaint
// on stderr rather than a non-zero code, so we scan for these explicitly.
const AUTH_ERROR_RE =
    /\b(invalid api key|unauthor\w*|not logged in|authenticat\w*|expired|revoked|forbidden|401|403|please run.*login|credit balance)\b/i

/**
 * Confirm an identity is usable *before* dispatching a batch (not mid-run):
 * resolve the alias, then run a trivial one-shot under its config dir with the
 * cheapest model, a short timeout, and read-only output flags. A clean exit
 * with output is healthy and stamps `lastUsedAt`; a non-zero exit, timeout, or
 * auth-error stderr is unhealthy and returns a short reason. Never throws for a
 * known alias — only `resolveAccount` may throw (unknown alias / missing key).
 */
export async function verifyAccount(alias: string): Promise<AccountHealth> {
    const { env } = resolveAccount(alias)
    const res = await runAgentOnce({
        cwd: config.workspaceDir,
        // Cheapest model (haiku) — this is a liveness probe, not real work.
        model: 'fast',
        prompt: 'ok',
        timeoutMs: config.generateTimeoutMs,
        // Read-only: print plain text, plan mode so the probe can't side-effect.
        extraArgs: '--print --output-format=text --permission-mode plan',
        accountEnv: env,
    })

    if (res.timedOut) return { ok: false, detail: 'verify timed out' }
    if (res.code !== 0) {
        const detail = (res.stderr || res.stdout).trim().slice(0, 200)
        return { ok: false, detail: detail || `agent exited with code ${res.code}` }
    }
    if (AUTH_ERROR_RE.test(res.stderr)) {
        return { ok: false, detail: res.stderr.trim().slice(0, 200) }
    }
    if (res.stdout.trim() === '') {
        const detail = res.stderr.trim().slice(0, 200)
        return { ok: false, detail: detail || 'no output from agent' }
    }

    accountRepo.markUsed(alias)
    return { ok: true, detail: 'ok' }
}
