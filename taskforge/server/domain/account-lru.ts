// Pure least-recently-used selection over the account registry — no I/O and no
// server-only deps, so the ordering/eligibility rules are unit-testable in
// isolation. The repository (`account-repo.pickLeastRecentlyUsed`) wraps these
// in a single transaction together with the `lastUsedAt` stamp for race-safety;
// this module owns only *which* account wins, never the persistence.

import type { Account } from '@/server/domain/types'

export interface PickOptions {
    /** Restrict rotation to this subset of aliases. Empty array ⇒ no eligible
     * account (a caller-imposed empty pool selects nothing). */
    pool?: string[]
    /** Restrict to a single auth method (e.g. only `oauth` subscription seats). */
    auth?: Account['auth']
}

/**
 * Whether `account` is eligible at `now` (an ISO-8601 instant): not currently
 * cooling down (`coolingUntil` unset or already in the past), and matching the
 * optional `pool`/`auth` constraints. ISO-8601 strings compare lexicographically
 * in chronological order, so `>` is a valid "still cooling" test.
 */
export function isEligible(account: Account, opts: PickOptions, now: string): boolean {
    if (account.coolingUntil && account.coolingUntil > now) return false
    if (opts.auth && account.auth !== opts.auth) return false
    if (opts.pool && !opts.pool.includes(account.alias)) return false
    return true
}

/**
 * Order two accounts least-recently-used first: a never-used account (no
 * `lastUsedAt`) sorts before any used one, then by oldest `lastUsedAt`, with
 * ties broken by `alias` so selection is fully deterministic.
 */
export function compareLru(a: Account, b: Account): number {
    const au = a.lastUsedAt
    const bu = b.lastUsedAt
    if (au === undefined && bu !== undefined) return -1
    if (au !== undefined && bu === undefined) return 1
    if (au !== undefined && bu !== undefined && au !== bu) return au < bu ? -1 : 1
    return a.alias < b.alias ? -1 : a.alias > b.alias ? 1 : 0
}

/**
 * The least-recently-used eligible account from `accounts`, or `null` when none
 * qualifies (including an explicitly empty `pool`). Pure: it neither mutates the
 * input nor stamps the winner — the repo does that inside the transaction.
 */
export function selectLru(accounts: Account[], opts: PickOptions, now: string): Account | null {
    if (opts.pool && opts.pool.length === 0) return null
    const eligible = accounts.filter((account) => isEligible(account, opts, now))
    if (eligible.length === 0) return null
    return eligible.slice().sort(compareLru)[0]
}
