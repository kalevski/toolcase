import { randomUUID } from 'node:crypto'
import { KeyBuilder } from './keys'
import { LuaScriptCache } from './scripts'
import type { RateLimitResult, RedisClient } from './types'

const RATELIMIT_NAMESPACE = 'ratelimit'
const WINDOW_NAMESPACE = 'window'
const BUCKET_NAMESPACE = 'bucket'
const CAPPED_NAMESPACE = 'capped'

export class RateLimiter {

	constructor(
		private readonly client: RedisClient,
		private readonly keys: KeyBuilder,
		private readonly scripts: LuaScriptCache,
	) {}

	async fixedWindow(
		key: string,
		limit: number,
		windowSeconds: number,
	): Promise<RateLimitResult> {
		const reply = (await this.scripts.get('rateLimit').run(this.client, {
			keys: [this.keys.build(RATELIMIT_NAMESPACE, key)],
			arguments: [String(windowSeconds)],
		})) as [number, number]
		const count = Number(reply[0])
		const ttl = Number(reply[1])
		return {
			allowed: count <= limit,
			count,
			limit,
			remaining: Math.max(0, limit - count),
			resetInSeconds: ttl >= 0 ? ttl : windowSeconds,
		}
	}

	async slidingWindow(
		key: string,
		limit: number,
		windowMs: number,
	): Promise<RateLimitResult> {
		const now = Date.now()
		const member = `${now}-${randomUUID()}`
		const reply = (await this.scripts.get('slidingWindow').run(this.client, {
			keys: [this.keys.build(WINDOW_NAMESPACE, key)],
			arguments: [String(now), String(windowMs), String(limit), member],
		})) as [number, number, number]
		return {
			allowed: Number(reply[0]) === 1,
			count: Number(reply[1]),
			limit,
			remaining: Number(reply[2]),
			resetInSeconds: Math.ceil(windowMs / 1000),
		}
	}

	async tokenBucket(
		key: string,
		capacity: number,
		refillPerSecond: number,
		cost = 1,
	): Promise<{ allowed: boolean; tokens: number }> {
		const now = Date.now()
		const reply = (await this.scripts.get('tokenBucket').run(this.client, {
			keys: [this.keys.build(BUCKET_NAMESPACE, key)],
			arguments: [
				String(capacity),
				String(refillPerSecond),
				String(now),
				String(cost),
			],
		})) as [number, string]
		return {
			allowed: Number(reply[0]) === 1,
			tokens: Number(reply[1]),
		}
	}

	async incrCapped(
		key: string,
		delta: number,
		max: number,
		ttlSeconds?: number,
	): Promise<{ allowed: boolean; current: number }> {
		const reply = (await this.scripts.get('incrCapped').run(this.client, {
			keys: [this.keys.build(CAPPED_NAMESPACE, key)],
			arguments: [
				String(delta),
				String(max),
				ttlSeconds ? String(ttlSeconds) : '',
			],
		})) as [number, number]
		return {
			allowed: Number(reply[0]) === 1,
			current: Number(reply[1]),
		}
	}
}
