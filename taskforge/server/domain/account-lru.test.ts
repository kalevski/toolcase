// Unit coverage for the pure LRU selection rules that drive multi-account load
// spreading. The repo layer (account-repo.pickLeastRecentlyUsed) wraps these in
// a transaction + `lastUsedAt` stamp; here we pin the ordering/eligibility logic
// and the rotation behaviour without touching SQLite.

import { describe, it, expect } from 'vitest'
import { selectLru, isEligible, compareLru, type PickOptions } from './account-lru'
import type { Account } from './types'

function acc(alias: string, fields: Partial<Account> = {}): Account {
    return { alias, dir: `/accounts/${alias}`, auth: 'oauth', ...fields }
}

const NOW = '2026-06-21T12:00:00.000Z'

describe('selectLru', () => {
    it('honours LRU order: never-used before used, then oldest lastUsedAt', () => {
        const accounts = [
            acc('alpha', { lastUsedAt: '2026-06-21T10:00:00.000Z' }),
            acc('beta', { lastUsedAt: '2026-06-21T08:00:00.000Z' }),
            acc('gamma'), // never used → wins outright
        ]
        expect(selectLru(accounts, {}, NOW)?.alias).toBe('gamma')

        // With gamma removed, the oldest stamp wins.
        expect(selectLru(accounts.slice(0, 2), {}, NOW)?.alias).toBe('beta')
    })

    it('breaks ties deterministically by alias', () => {
        const stamp = '2026-06-21T09:00:00.000Z'
        const accounts = [
            acc('zeta', { lastUsedAt: stamp }),
            acc('delta', { lastUsedAt: stamp }),
        ]
        expect(selectLru(accounts, {}, NOW)?.alias).toBe('delta')
        // Order of input must not matter.
        expect(selectLru(accounts.slice().reverse(), {}, NOW)?.alias).toBe('delta')
    })

    it('rotates so repeated picks advance (lastUsedAt drives load spreading)', () => {
        // Simulate the stamp the repo applies: after a pick, set lastUsedAt = now
        // and the next pick should move on to the next-oldest account.
        const state: Account[] = [acc('a'), acc('b'), acc('c')]
        const picks: string[] = []
        const ticks = [
            '2026-06-21T12:00:01.000Z',
            '2026-06-21T12:00:02.000Z',
            '2026-06-21T12:00:03.000Z',
            '2026-06-21T12:00:04.000Z',
        ]
        for (const tick of ticks) {
            const chosen = selectLru(state, {}, tick)!
            picks.push(chosen.alias)
            // Mutate a copy of the registry as the transaction would persist it.
            const idx = state.findIndex((s) => s.alias === chosen.alias)
            state[idx] = { ...state[idx], lastUsedAt: tick }
        }
        // First three picks exhaust the never-used trio (alias-tie order), then
        // the fourth wraps back to the earliest-stamped one.
        expect(picks).toEqual(['a', 'b', 'c', 'a'])
    })

    it('excludes accounts still cooling down, includes those whose cooldown passed', () => {
        const accounts = [
            acc('cooling', { lastUsedAt: '2026-06-21T07:00:00.000Z', coolingUntil: '2026-06-21T13:00:00.000Z' }),
            acc('ready', { lastUsedAt: '2026-06-21T11:00:00.000Z', coolingUntil: '2026-06-21T11:30:00.000Z' }),
        ]
        // `cooling` is the oldest but still cooling at NOW, so `ready` wins.
        expect(selectLru(accounts, {}, NOW)?.alias).toBe('ready')

        // Only-cooling pool ⇒ nothing eligible.
        expect(selectLru([accounts[0]], {}, NOW)).toBeNull()
    })

    it('restricts to an explicit pool and returns null for an empty pool', () => {
        const accounts = [acc('alpha'), acc('beta'), acc('gamma')]
        const opts: PickOptions = { pool: ['beta', 'gamma'] }
        expect(selectLru(accounts, opts, NOW)?.alias).toBe('beta')
        expect(selectLru(accounts, { pool: [] }, NOW)).toBeNull()
    })

    it('restricts to a single auth method', () => {
        const accounts = [
            acc('key-bot', { auth: 'apikey' }),
            acc('sub', { auth: 'oauth', lastUsedAt: '2026-06-21T09:00:00.000Z' }),
        ]
        expect(selectLru(accounts, { auth: 'apikey' }, NOW)?.alias).toBe('key-bot')
        expect(selectLru(accounts, { auth: 'oauth' }, NOW)?.alias).toBe('sub')
    })

    it('returns null when there are no accounts', () => {
        expect(selectLru([], {}, NOW)).toBeNull()
    })
})

describe('isEligible', () => {
    it('treats a cooldown exactly at now as eligible (boundary)', () => {
        expect(isEligible(acc('x', { coolingUntil: NOW }), {}, NOW)).toBe(true)
        expect(isEligible(acc('x', { coolingUntil: '2026-06-21T12:00:00.001Z' }), {}, NOW)).toBe(false)
    })
})

describe('compareLru', () => {
    it('orders never-used before used and is sign-consistent', () => {
        const used = acc('u', { lastUsedAt: NOW })
        const fresh = acc('f')
        expect(compareLru(fresh, used)).toBeLessThan(0)
        expect(compareLru(used, fresh)).toBeGreaterThan(0)
    })
})
