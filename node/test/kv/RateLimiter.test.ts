import { describe, it, expect, vi } from 'vitest'
import { RateLimiter } from '../../src/kv/RateLimiter'
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../src/kv/keys'
import { LuaScriptCache, KV_LUA_SCRIPTS } from '../../src/kv/scripts'

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

describe('RateLimiter.incrCapped', () => {

    it('returns allowed=true and current value when under cap', async () => {
        const client = makeClient([1, 3])
        const limiter = makeRateLimiter(client)
        const result = await limiter.incrCapped('k', 1, 10, 60)
        expect(result.allowed).toBe(true)
        expect(result.current).toBe(3)
    })

    it('returns allowed=false when at cap', async () => {
        const client = makeClient([0, 10])
        const limiter = makeRateLimiter(client)
        const result = await limiter.incrCapped('k', 1, 10)
        expect(result.allowed).toBe(false)
        expect(result.current).toBe(10)
    })

    it('passes ttl as empty string when not provided', async () => {
        const client = makeClient([1, 1])
        const limiter = makeRateLimiter(client)
        await limiter.incrCapped('k', 1, 10)
        const args: string[] = client.evalSha.mock.calls[0][1].arguments
        expect(args[2]).toBe('')
    })

    it('passes ttl as string when provided', async () => {
        const client = makeClient([1, 1])
        const limiter = makeRateLimiter(client)
        await limiter.incrCapped('k', 1, 10, 60)
        const args: string[] = client.evalSha.mock.calls[0][1].arguments
        expect(args[2]).toBe('60')
    })

    it('Lua script sets TTL only on new key (is_new guard present in source)', () => {
        expect(KV_LUA_SCRIPTS.incrCapped).toContain('is_new')
        expect(KV_LUA_SCRIPTS.incrCapped).toContain('if is_new and ARGV[3]')
    })
})

describe('RateLimiter.fixedWindow', () => {

    it('returns allowed=true when count is at or below limit', async () => {
        const client = makeClient([3, 30])
        const limiter = makeRateLimiter(client)
        const result = await limiter.fixedWindow('k', 5, 30)
        expect(result.allowed).toBe(true)
        expect(result.count).toBe(3)
        expect(result.remaining).toBe(2)
    })

    it('returns allowed=false when count exceeds limit', async () => {
        const client = makeClient([6, 30])
        const limiter = makeRateLimiter(client)
        const result = await limiter.fixedWindow('k', 5, 30)
        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('Lua script resets counter to 1 on TTL-loss (SET guard present in source)', () => {
        expect(KV_LUA_SCRIPTS.rateLimit).toContain('redis.call("SET", KEYS[1], "1")')
        expect(KV_LUA_SCRIPTS.rateLimit).toContain('v = 1')
    })
})

describe('RateLimiter.slidingWindow', () => {

    it('returns allowed=true and correct counts when under limit', async () => {
        const client = makeClient([1, 2, 3])
        const limiter = makeRateLimiter(client)
        const result = await limiter.slidingWindow('k', 5, 60_000)
        expect(result.allowed).toBe(true)
        expect(result.count).toBe(2)
        expect(result.remaining).toBe(3)
    })

    it('returns allowed=false when at limit', async () => {
        const client = makeClient([0, 5, 0])
        const limiter = makeRateLimiter(client)
        const result = await limiter.slidingWindow('k', 5, 60_000)
        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('Lua script calls PEXPIRE on the denied path', () => {
        const src = KV_LUA_SCRIPTS.slidingWindow
        // PEXPIRE must appear after the if-block (denied path)
        const deniedSection = src.slice(src.indexOf('return {0, count, 0}') - 100)
        expect(deniedSection).toContain('PEXPIRE')
    })
})

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
