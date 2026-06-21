import { describe, it, expect, vi } from 'vitest'
import { RateLimiter } from '../../src/kv/RateLimiter'
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../src/kv/keys'
import { LuaScriptCache } from '../../src/kv/scripts'

function makeClient(reply: unknown) {
    return {
        evalSha: vi.fn().mockResolvedValue(reply),
        eval: vi.fn().mockResolvedValue(reply),
    }
}

function makeRateLimiter(client: unknown) {
    const keys = new KeyBuilder('test', KV_KEY_SEPARATOR)
    const scripts = new LuaScriptCache()
    return new RateLimiter(client as never, keys, scripts)
}

describe('RateLimiter.tokenBucket', () => {

    it('rejects negative refillPerSecond', async () => {
        const limiter = makeRateLimiter(makeClient([1, '10']))
        await expect(limiter.tokenBucket('k', 10, -1)).rejects.toThrow(RangeError)
    })

    it('accepts refillPerSecond = 0 and reports allowed when tokens available', async () => {
        // regression: refill=0 caused EXPIRE key inf on the Redis side — the Lua fix
        // guards with `if refill > 0 then ... else ttl = math.ceil(capacity) + 1 end`
        const client = makeClient([1, '9'])
        const limiter = makeRateLimiter(client)
        const result = await limiter.tokenBucket('no-refill', 10, 0, 1)
        expect(result.allowed).toBe(true)
        expect(result.tokens).toBe(9)
        expect(client.evalSha).toHaveBeenCalledOnce()
    })

    it('accepts refillPerSecond = 0 and reports denied when bucket empty', async () => {
        const client = makeClient([0, '0'])
        const limiter = makeRateLimiter(client)
        const result = await limiter.tokenBucket('no-refill', 10, 0, 1)
        expect(result.allowed).toBe(false)
        expect(result.tokens).toBe(0)
    })

    it('forwards capacity, refill, cost to the script arguments', async () => {
        const client = makeClient([1, '4'])
        const limiter = makeRateLimiter(client)
        await limiter.tokenBucket('k', 5, 0, 1)
        const call = client.evalSha.mock.calls[0]
        const args: string[] = call[1].arguments
        expect(args[0]).toBe('5')   // capacity
        expect(args[1]).toBe('0')   // refillPerSecond
        expect(args[3]).toBe('1')   // cost
    })
})
