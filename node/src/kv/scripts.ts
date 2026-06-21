import { createHash } from 'crypto'
import type { KVCommandHook, RedisClient } from './types'

const LUA_COMPARE_AND_SET = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
	if ARGV[3] ~= "" then
		redis.call("SET", KEYS[1], ARGV[2], "PX", tonumber(ARGV[3]))
	else
		redis.call("SET", KEYS[1], ARGV[2])
	end
	return 1
end
return 0
`.trim()

const LUA_COMPARE_AND_DEL = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`.trim()

const LUA_EXTEND_LOCK = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[2]))
end
return 0
`.trim()

const LUA_SLIDING_WINDOW = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now - window)
local count = redis.call("ZCARD", KEYS[1])
if count < limit then
	redis.call("ZADD", KEYS[1], now, member)
	redis.call("PEXPIRE", KEYS[1], window)
	return {1, count + 1, limit - count - 1}
end
return {0, count, 0}
`.trim()

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local data = redis.call("HMGET", key, "tokens", "last")
local tokens = tonumber(data[1])
if tokens == nil then tokens = capacity end
local last = tonumber(data[2])
if last == nil then last = now end
local elapsed = math.max(0, now - last) / 1000
tokens = math.min(capacity, tokens + elapsed * refill)
local allowed = 0
if tokens >= cost then
	tokens = tokens - cost
	allowed = 1
end
redis.call("HSET", key, "tokens", tostring(tokens), "last", tostring(now))
local ttl
if refill > 0 then ttl = math.ceil(capacity / refill) + 1 else ttl = math.ceil(capacity) + 1 end
redis.call("EXPIRE", key, ttl)
return {allowed, tostring(tokens)}
`.trim()

const LUA_INCR_CAPPED = `
local current = tonumber(redis.call("GET", KEYS[1]))
if current == nil then current = 0 end
local delta = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
if current + delta > cap then
	return {0, current}
end
local next = redis.call("INCRBY", KEYS[1], delta)
if ARGV[3] ~= "" then
	redis.call("EXPIRE", KEYS[1], tonumber(ARGV[3]))
end
return {1, next}
`.trim()

const LUA_GET_AND_TOUCH = `
local v = redis.call("GET", KEYS[1])
if v then
	redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
end
return v
`.trim()

const LUA_VERSIONED_SET = `
local cur = redis.call("HGET", KEYS[1], "version")
if cur and tonumber(cur) ~= tonumber(ARGV[1]) then
	return {0, tonumber(cur)}
end
if not cur and tonumber(ARGV[1]) ~= 0 then
	return {0, 0}
end
local nextVersion = tonumber(ARGV[1]) + 1
redis.call("HSET", KEYS[1], "version", tostring(nextVersion), "data", ARGV[2])
if ARGV[3] ~= "" then
	redis.call("EXPIRE", KEYS[1], tonumber(ARGV[3]))
end
return {1, nextVersion}
`.trim()

const LUA_ADD_SCORE_RANK = `
redis.call("ZADD", KEYS[1], ARGV[1], ARGV[2])
local rank = redis.call("ZREVRANK", KEYS[1], ARGV[2])
local score = redis.call("ZSCORE", KEYS[1], ARGV[2])
if rank == false then rank = -1 end
if score == false then score = "0" end
return {rank, score}
`.trim()

const LUA_POP_N = `
local results = {}
local count = tonumber(ARGV[1])
for i = 1, count do
	local v = redis.call("LPOP", KEYS[1])
	if not v then break end
	table.insert(results, v)
end
return results
`.trim()

const LUA_INCR_WITH_TTL = `
local v = redis.call("INCR", KEYS[1])
if v == 1 then
	redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
end
return v
`.trim()

const LUA_RATE_LIMIT = `
local v = redis.call("INCR", KEYS[1])
local ttl
if v == 1 then
	redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
	ttl = tonumber(ARGV[1])
else
	ttl = redis.call("TTL", KEYS[1])
	if ttl < 0 then
		redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
		ttl = tonumber(ARGV[1])
	end
end
return {v, ttl}
`.trim()

export const KV_LUA_SCRIPTS = {
	compareAndSet: LUA_COMPARE_AND_SET,
	compareAndDel: LUA_COMPARE_AND_DEL,
	extendLock: LUA_EXTEND_LOCK,
	slidingWindow: LUA_SLIDING_WINDOW,
	tokenBucket: LUA_TOKEN_BUCKET,
	incrCapped: LUA_INCR_CAPPED,
	getAndTouch: LUA_GET_AND_TOUCH,
	versionedSet: LUA_VERSIONED_SET,
	addScoreAndRank: LUA_ADD_SCORE_RANK,
	popN: LUA_POP_N,
	incrWithTTL: LUA_INCR_WITH_TTL,
	rateLimit: LUA_RATE_LIMIT,
} as const

export type LuaScriptName = keyof typeof KV_LUA_SCRIPTS

interface EvalOptions {
	keys: string[]
	arguments: string[]
}

interface ClientWithEval {
	eval: (script: string, options: EvalOptions) => Promise<unknown>
	evalSha: (sha: string, options: EvalOptions) => Promise<unknown>
}

const NOSCRIPT_PATTERN = /NOSCRIPT/i

export class LuaScript {

	private readonly source: string
	readonly sha: string

	constructor(
		source: string,
		private readonly name: string = 'lua',
		private readonly onCommand?: KVCommandHook,
	) {
		this.source = source
		this.sha = createHash('sha1').update(source, 'utf8').digest('hex')
	}

	async run(client: RedisClient | unknown, options: EvalOptions): Promise<unknown> {
		const c = client as ClientWithEval
		const start = this.onCommand ? Date.now() : 0
		let err: unknown
		try {
			try {
				return await c.evalSha(this.sha, options)
			} catch (error) {
				if (error instanceof Error && NOSCRIPT_PATTERN.test(error.message)) {
					return await c.eval(this.source, options)
				}
				throw error
			}
		} catch (error) {
			err = error
			throw error
		} finally {
			if (this.onCommand) {
				this.onCommand(`lua.${this.name}`, Date.now() - start, err)
			}
		}
	}
}

export class LuaScriptCache {

	private readonly cache = new Map<LuaScriptName, LuaScript>()

	constructor(private readonly onCommand?: KVCommandHook) {}

	get(name: LuaScriptName): LuaScript {
		const cached = this.cache.get(name)
		if (cached) return cached
		const script = new LuaScript(KV_LUA_SCRIPTS[name], name, this.onCommand)
		this.cache.set(name, script)
		return script
	}
}
