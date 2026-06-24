// Claude account registry — resolution layer over the `account` table
// (multi-account foundation). Consumers read accounts and resolve an alias to
// the env needed to spawn the `claude` CLI under that identity. This module
// owns the secret boundary: the API key is read from `process.env[apiKeyEnv]`
// only here, at resolution time, and never persisted.

import 'server-only'
import { promises as fs } from 'node:fs'
import { config } from '@/server/config'
import * as accountRepo from '@/server/data/repositories/account-repo'
import { runAgentOnce } from '@/server/infrastructure/agent'
import { scrubSecrets } from '@/server/domain/account-secrets'
import { slog } from '@/server/infrastructure/server-log'
import type { Account, AccountHealth, AccountSummary } from '@/server/domain/types'

// Per-alias config dirs hold `.credentials.json` OAuth tokens — real secrets.
// Lock the whole tree to owner-only (`0o700`, rwx------) so a world-readable
// workspace can't expose another account's credentials. `mkdir`'s mode argument
// is masked by the process umask, so we always follow up with an explicit
// `chmod` to pin the exact mode.
const ACCOUNT_DIR_MODE = 0o700

// Re-exported so existing consumers can keep importing it from this service.
export type { AccountSummary }

/** Unknown alias passed to `resolveAccount`. */
export class UnknownAccountError extends Error {
    constructor(alias: string) {
        super(`unknown account alias: "${alias}"`)
    }
}

/** Attempt to register an alias that is already in the registry. */
export class AccountExistsError extends Error {
    constructor(alias: string) {
        super(`account alias "${alias}" already exists`)
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

/**
 * Create `dir` (recursively) and pin it to owner-only `0o700`. Idempotent: a
 * pre-existing dir is left in place and its mode is repaired. Only `dir` itself
 * is chmod'd — secure the parent `accountsDir` with a separate call so the tree
 * is never wider than its children.
 */
async function mkdirSecure(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true, mode: ACCOUNT_DIR_MODE })
    // mkdir's mode is umask-masked; chmod pins the exact mode (and repairs an
    // already-existing dir that was created world-readable).
    await fs.chmod(dir, ACCOUNT_DIR_MODE)
}

/**
 * Boot-time hardening for the accounts tree: ensure `accountsDir` exists at
 * `0o700` and repair the mode of the tree and every per-alias config dir under
 * it if it was created (or copied in) with looser permissions. Best-effort and
 * idempotent — logs and swallows errors so a permissions hiccup never blocks
 * startup. Called from `instrumentation.ts` once per server start.
 */
export async function ensureAccountsDirSecure(): Promise<void> {
    try {
        await mkdirSecure(config.accountsDir)
        const entries = await fs.readdir(config.accountsDir, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory()) {
                await fs.chmod(`${config.accountsDir}/${entry.name}`, ACCOUNT_DIR_MODE).catch(() => {})
            }
        }
    } catch (err: any) {
        slog('warn', 'accounts', 'could not harden accounts dir permissions', {
            dir: config.accountsDir,
            error: err?.message ?? String(err),
        })
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
 * Build the non-secret registry view for the management surface — see
 * {@link AccountSummary} (every account's metadata plus its cached runtime state:
 * `lastUsedAt` as the last known-good "health" stamp, `coolingUntil`, and a
 * derived `cooling` flag, true while a quota cool-down is still in effect). Holds
 * no secrets: the API key value is never stored, only the env-var name that
 * references it. `now` is injectable for deterministic tests.
 */
export function listAccountSummaries(now: string = new Date().toISOString()): AccountSummary[] {
    return accountRepo.list().map((a) => ({
        alias: a.alias,
        dir: a.dir,
        auth: a.auth,
        label: a.label,
        apiKeyEnv: a.apiKeyEnv,
        lastUsedAt: a.lastUsedAt,
        coolingUntil: a.coolingUntil,
        cooling: !!a.coolingUntil && a.coolingUntil > now,
    }))
}

/** Outcome of `registerAccount` — the persisted row plus optional next-step
 * `guidance` (the host-side `claude /login` to finish an `oauth` account). */
export interface RegisterResult {
    account: Account
    guidance?: string
}

/**
 * Register a new account: validate the alias is kebab-case and the auth shape is
 * coherent (`apikey` requires an env-var name), reject a duplicate alias, create
 * its isolated config dir under `accountsDir`, and persist the registry row. For
 * `oauth` accounts the dir is created empty and `guidance` instructs the operator
 * to run an interactive `claude /login` against that `CLAUDE_CONFIG_DIR` on the
 * host to complete authorization (it cannot be done over HTTP). Throws
 * `InvalidAccountError` (bad alias/auth) or `AccountExistsError` (duplicate).
 */
export async function registerAccount(input: accountRepo.AccountInput): Promise<RegisterResult> {
    accountRepo.validate(input)
    if (accountRepo.get(input.alias)) throw new AccountExistsError(input.alias)

    const dir = accountRepo.defaultDir(input.alias)
    // Owner-only perms from creation: this dir will hold `.credentials.json`.
    // Lock the parent tree first so a freshly-created `accountsDir` isn't left
    // world-readable, then the per-alias dir.
    await mkdirSecure(config.accountsDir)
    await mkdirSecure(dir)
    const account = accountRepo.upsert({ ...input, dir })

    const guidance =
        account.auth === 'oauth'
            ? `Created empty config dir ${dir}. To finish authorization, run an interactive ` +
              `\`claude /login\` on the host with CLAUDE_CONFIG_DIR=${dir} set.`
            : undefined
    return { account, guidance }
}

/**
 * Remove an account: delete its registry row and its isolated config dir.
 * Returns false when the alias is unknown (so the caller can 404); dir removal
 * is best-effort so a missing/locked dir never leaves a dangling row.
 */
export async function removeAccount(alias: string): Promise<boolean> {
    const account = accountRepo.get(alias)
    if (!account) return false
    accountRepo.remove(alias)
    await fs.rm(account.dir, { recursive: true, force: true }).catch(() => {})
    return true
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
    const { dir, env } = resolveAccount(alias)
    // The probe runs under this account's resolved env; its stderr/stdout could
    // echo the spawn env (CLAUDE_CONFIG_DIR / API key). Scrub both out of every
    // `detail` we surface so a secret never reaches the health API or a log.
    const scrub = (s: string): string => scrubSecrets(s, [env.ANTHROPIC_API_KEY, dir])
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
        const detail = scrub((res.stderr || res.stdout).trim()).slice(0, 200)
        return { ok: false, detail: detail || `agent exited with code ${res.code}` }
    }
    if (AUTH_ERROR_RE.test(res.stderr)) {
        return { ok: false, detail: scrub(res.stderr.trim()).slice(0, 200) }
    }
    if (res.stdout.trim() === '') {
        const detail = scrub(res.stderr.trim()).slice(0, 200)
        return { ok: false, detail: detail || 'no output from agent' }
    }

    accountRepo.markUsed(alias)
    return { ok: true, detail: 'ok' }
}
