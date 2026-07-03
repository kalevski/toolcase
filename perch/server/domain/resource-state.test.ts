// Transition-table coverage for the pure episode differ behind the status poller
// (perch_better.md B1): open / refresh / close / state-change re-open.

import { describe, it, expect } from 'vitest'
import { diffEpisodes, type LiveBadState, type OpenEpisode } from './resource-state'

const bad = (kind: string, key: string, state: string, reason?: string): LiveBadState => ({
    kind,
    key,
    state,
    reason,
})

const ep = (id: number, kind: string, key: string, state: string): OpenEpisode => ({ id, kind, key, state })

describe('diffEpisodes', () => {
    it('opens an episode for a fresh non-active resource', () => {
        const t = diffEpisodes([bad('proxy', 'a.com', 'at_risk', 'nginx -t: boom')], [])
        expect(t).toEqual({
            open: [bad('proxy', 'a.com', 'at_risk', 'nginx -t: boom')],
            close: [],
            refresh: [],
        })
    })

    it('refreshes an open episode that persists in the same state', () => {
        const t = diffEpisodes([bad('proxy', 'a.com', 'at_risk', 'newer reason')], [ep(7, 'proxy', 'a.com', 'at_risk')])
        expect(t).toEqual({ open: [], close: [], refresh: [{ id: 7, reason: 'newer reason' }] })
    })

    it('closes an open episode whose resource recovered (or disappeared)', () => {
        const t = diffEpisodes([], [ep(7, 'proxy', 'a.com', 'at_risk')])
        expect(t).toEqual({ open: [], close: [7], refresh: [] })
    })

    it('closes + reopens on a state change (at_risk escalated to disabled)', () => {
        const t = diffEpisodes([bad('proxy', 'a.com', 'disabled', 'quarantined')], [ep(7, 'proxy', 'a.com', 'at_risk')])
        expect(t).toEqual({
            open: [bad('proxy', 'a.com', 'disabled', 'quarantined')],
            close: [7],
            refresh: [],
        })
    })

    it('keys episodes by kind AND key — the same domain in two kinds is two episodes', () => {
        const t = diffEpisodes(
            [bad('proxy', 'a.com', 'at_risk'), bad('redirect', 'a.com', 'disabled')],
            [ep(1, 'proxy', 'a.com', 'at_risk')],
        )
        expect(t).toEqual({
            open: [bad('redirect', 'a.com', 'disabled')],
            close: [],
            refresh: [{ id: 1, reason: undefined }],
        })
    })

    it('handles a mixed tick: one opens, one refreshes, one closes', () => {
        const t = diffEpisodes(
            [bad('proxy', 'keep.com', 'at_risk'), bad('cert', 'new.com', 'renew_failed', 'rate limited')],
            [ep(1, 'proxy', 'keep.com', 'at_risk'), ep(2, 'stream', 'db', 'disabled')],
        )
        expect(t).toEqual({
            open: [bad('cert', 'new.com', 'renew_failed', 'rate limited')],
            close: [2],
            refresh: [{ id: 1, reason: undefined }],
        })
    })
})
