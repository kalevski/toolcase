import { describe, it, expect, vi } from 'vitest'
import { Leaderboard } from '../../src/kv/Leaderboard'
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../src/kv/keys'
import { LuaScriptCache } from '../../src/kv/scripts'

function makeClient(evalReply: unknown, rankReply: unknown = 0) {
    return {
        evalSha: vi.fn().mockResolvedValue(evalReply),
        eval: vi.fn().mockResolvedValue(evalReply),
        zRevRank: vi.fn().mockResolvedValue(rankReply),
        zRank: vi.fn().mockResolvedValue(rankReply),
        // zAdd returns added-count (0 when member already existed, 1 when new)
        zAdd: vi.fn().mockResolvedValue(0),
    }
}

function makeLeaderboard(client: unknown, direction?: 'asc' | 'desc') {
    const keys = new KeyBuilder('test', KV_KEY_SEPARATOR)
    const scripts = new LuaScriptCache()
    return new Leaderboard(client as never, keys, scripts, direction ? { direction } : {})
}

describe('Leaderboard.addScore', () => {

    it('returns void (not the ZADD added-count) when updating an existing member', async () => {
        // zAdd returns 0 when the member already existed but its score was updated —
        // the old implementation forwarded that 0 to callers who expected the stored score.
        const client = makeClient(null)
        client.zAdd.mockResolvedValue(0)
        const board = makeLeaderboard(client)
        const result = await board.addScore('scores', 'alice', 42)
        expect(result).toBeUndefined()
    })

    it('calls zAdd with the correct key and score payload', async () => {
        const client = makeClient(null)
        const board = makeLeaderboard(client)
        await board.addScore('scores', 'bob', 99)
        expect(client.zAdd).toHaveBeenCalledOnce()
        expect(client.zAdd).toHaveBeenCalledWith('test:scores', { score: 99, value: 'bob' })
    })
})

describe('Leaderboard.addScoreAndRank direction', () => {

    it('passes "desc" as the third script argument when direction is desc (default)', async () => {
        const client = makeClient([2, '100'])
        const board = makeLeaderboard(client)
        await board.addScoreAndRank('scores', 'alice', 100)
        const call = client.evalSha.mock.calls[0]
        const args: string[] = call[1].arguments
        expect(args[2]).toBe('desc')
    })

    it('passes "asc" as the third script argument when direction is asc', async () => {
        const client = makeClient([2, '100'])
        const board = makeLeaderboard(client, 'asc')
        await board.addScoreAndRank('scores', 'alice', 100)
        const call = client.evalSha.mock.calls[0]
        const args: string[] = call[1].arguments
        expect(args[2]).toBe('asc')
    })

    it('addScoreAndRank and rankOf agree for direction asc', async () => {
        // Both should return rank 2 for the same member
        const client = makeClient([2, '50'], 2)
        const board = makeLeaderboard(client, 'asc')
        const { rank: rankFromAdd } = await board.addScoreAndRank('scores', 'bob', 50)
        const rankFromQuery = await board.rankOf('scores', 'bob')
        expect(rankFromAdd).toBe(rankFromQuery)
        // rankOf for asc uses zRank, not zRevRank
        expect(client.zRank).toHaveBeenCalledOnce()
        expect(client.zRevRank).not.toHaveBeenCalled()
    })

    it('addScoreAndRank and rankOf agree for direction desc', async () => {
        const client = makeClient([0, '200'], 0)
        const board = makeLeaderboard(client, 'desc')
        const { rank: rankFromAdd } = await board.addScoreAndRank('scores', 'carol', 200)
        const rankFromQuery = await board.rankOf('scores', 'carol')
        expect(rankFromAdd).toBe(rankFromQuery)
        // rankOf for desc uses zRevRank
        expect(client.zRevRank).toHaveBeenCalledOnce()
        expect(client.zRank).not.toHaveBeenCalled()
    })
})
