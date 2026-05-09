import { RESP_TYPES, type SetOptions } from 'redis'
import { KVServiceError } from '../errors'
import { KV_KEY_SEPARATOR, KeyBuilder } from './keys'
import { Leaderboard } from './Leaderboard'
import { Locker, LockHandle, WithLockOptions } from './Locker'
import { LuaScriptCache, KV_LUA_SCRIPTS } from './scripts'
import { RateLimiter } from './RateLimiter'
import { SubscriberPool } from './SubscriberPool'
import type {
	KVCommandHook,
	KVServiceOptions,
	LeaderboardEntry,
	RateLimitResult,
	RedisClient,
	SubscribeHandler,
	Subscription,
} from './types'
import { ValueStore } from './ValueStore'
import { Versioned } from './Versioned'

const SCAN_BATCH_DEFAULT = 100
const DEL_BATCH_LIMIT = 500

export interface DelByPatternOptions {
	confirm?: boolean
}

export class KVService {

	readonly client: RedisClient
	readonly namespace: string
	readonly separator: string
	readonly serializer: KVServiceOptions['serializer']

	readonly keys: KeyBuilder
	readonly scripts: LuaScriptCache
	readonly locker: Locker
	readonly rateLimiter: RateLimiter
	readonly leaderboard: Leaderboard
	readonly objects: ValueStore
	readonly versioned: Versioned
	readonly subscribers: SubscriberPool

	private readonly logger: KVServiceOptions['logger']
	private readonly onCommand?: KVCommandHook
	private readonly onSubscriberError?: KVServiceOptions['onSubscriberError']

	constructor(options: KVServiceOptions) {
		this.client = options.client
		this.namespace = options.namespace ?? ''
		this.separator = options.separator ?? KV_KEY_SEPARATOR
		this.serializer = options.serializer
		this.logger = options.logger
		this.onCommand = options.onCommand
		this.onSubscriberError = options.onSubscriberError
		this.keys = new KeyBuilder(this.namespace, this.separator)
		this.scripts = options.scripts ?? new LuaScriptCache(this.onCommand)
		this.locker = new Locker(this.client, this.keys, this.scripts)
		this.rateLimiter = new RateLimiter(this.client, this.keys, this.scripts)
		this.leaderboard = new Leaderboard(this.client, this.keys, this.scripts)
		this.subscribers = new SubscriberPool(() => this.duplicate(), this.onSubscriberError)
		const withTypeMapping = (this.client as unknown as {
			withTypeMapping?: (mapping: Record<number, unknown>) => unknown
		}).withTypeMapping
		if (typeof withTypeMapping !== 'function') {
			throw new KVServiceError(
				'redis client does not support withTypeMapping (requires node-redis v5+)',
			)
		}
		const bufferClient = withTypeMapping.call(this.client, {
			[RESP_TYPES.BLOB_STRING]: Buffer,
		})
		this.objects = new ValueStore(
			this.client,
			this.keys,
			this.scripts,
			this.serializer,
			this.subscribers,
			bufferClient,
		)
		this.versioned = new Versioned(this.client, this.keys, this.scripts, this.serializer, bufferClient)
	}

	private async track<T>(op: string, fn: () => Promise<T>): Promise<T> {
		if (!this.onCommand) return fn()
		const start = Date.now()
		let err: unknown
		try {
			return await fn()
		} catch (error) {
			err = error
			throw error
		} finally {
			this.onCommand(op, Date.now() - start, err)
		}
	}

	key(...parts: (string | number)[]): string {
		return this.keys.build(...parts)
	}

	/**
	 * Returns a child `KVService` whose keys are namespaced under `namespace`.
	 * Allocates a fresh `KVService`, `Leaderboard`, `Locker`, etc. — call this
	 * at boot/DI wiring time, not from per-request handlers. If a future
	 * caller becomes hot (per-request), cache the result in a Map.
	 */
	scoped(namespace: string, serializer?: KVServiceOptions['serializer']): KVService {
		const next = this.keys.scope(namespace).namespace
		return new KVService({
			client: this.client,
			namespace: next,
			separator: this.separator,
			serializer: serializer ?? this.serializer,
			logger: this.logger,
			onCommand: this.onCommand,
			onSubscriberError: this.onSubscriberError,
			scripts: this.scripts,
		})
	}

	duplicate(): RedisClient {
		return this.client.duplicate() as RedisClient
	}

	/**
	 * Eagerly load all KV Lua scripts into Redis script cache.
	 * Subsequent calls hit EVALSHA without the NOSCRIPT fallback.
	 */
	async warmScripts(): Promise<void> {
		const names = Object.keys(KV_LUA_SCRIPTS) as (keyof typeof KV_LUA_SCRIPTS)[]
		await Promise.all(names.map(async (name) => {
			const sha = this.scripts.get(name).sha
			await (this.client as unknown as {
				scriptLoad: (source: string) => Promise<string>
			}).scriptLoad(KV_LUA_SCRIPTS[name]).catch(() => sha)
		}))
	}

	ping(): Promise<string> {
		return this.client.ping()
	}

	async close(): Promise<void> {
		await this.subscribers.close().catch(() => {})
		if (this.client.isOpen) {
			await this.client.quit().catch(() => {})
		}
	}

	get(key: string): Promise<string | null> {
		const fullKey = this.key(key)
		if (!this.onCommand) return this.client.get(fullKey) as Promise<string | null>
		return this.track('get', () => this.client.get(fullKey) as Promise<string | null>)
	}

	set(
		key: string,
		value: string | number | Buffer,
		options?: SetOptions,
	): Promise<string | null> {
		const fullKey = this.key(key)
		if (!this.onCommand) return this.client.set(fullKey, value as string, options) as Promise<string | null>
		return this.track('set', () => this.client.set(fullKey, value as string, options) as Promise<string | null>)
	}

	async setNX(
		key: string,
		value: string | number | Buffer,
		ttlMs?: number,
	): Promise<boolean> {
		const opts: SetOptions = ttlMs ? { NX: true, PX: ttlMs } : { NX: true }
		const fullKey = this.key(key)
		const reply = this.onCommand
			? await this.track('setNX', () => this.client.set(fullKey, value as string, opts))
			: await this.client.set(fullKey, value as string, opts)
		return reply !== null
	}

	getDel(key: string): Promise<string | null> {
		const fullKey = this.key(key)
		if (!this.onCommand) return this.client.getDel(fullKey) as Promise<string | null>
		return this.track('getDel', () => this.client.getDel(fullKey) as Promise<string | null>)
	}

	getSet(key: string, value: string | number | Buffer): Promise<string | null> {
		const fullKey = this.key(key)
		if (!this.onCommand) return this.client.set(fullKey, value as string, { GET: true }) as Promise<string | null>
		return this.track('getSet', () => this.client.set(fullKey, value as string, { GET: true }) as Promise<string | null>)
	}

	del(key: string | string[]): Promise<number> {
		const keys = Array.isArray(key) ? key.map((k) => this.key(k)) : this.key(key)
		if (!this.onCommand) return this.client.del(keys)
		return this.track('del', () => this.client.del(keys))
	}

	exists(key: string | string[]): Promise<number> {
		const keys = Array.isArray(key) ? key.map((k) => this.key(k)) : this.key(key)
		if (!this.onCommand) return this.client.exists(keys)
		return this.track('exists', () => this.client.exists(keys))
	}

	async expire(key: string, seconds: number): Promise<boolean> {
		const k = this.key(key)
		return Boolean(await this.track('expire', () => this.client.expire(k, seconds)))
	}

	async pExpire(key: string, ms: number): Promise<boolean> {
		const k = this.key(key)
		return Boolean(await this.track('pExpire', () => this.client.pExpire(k, ms)))
	}

	async expireAt(key: string, unixSeconds: number): Promise<boolean> {
		const k = this.key(key)
		return Boolean(await this.track('expireAt', () => this.client.expireAt(k, unixSeconds)))
	}

	async persist(key: string): Promise<boolean> {
		const k = this.key(key)
		return Boolean(await this.track('persist', () => this.client.persist(k)))
	}

	ttl(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('ttl', () => this.client.ttl(k))
	}

	type(key: string): Promise<string> {
		const k = this.key(key)
		return this.track('type', () => this.client.type(k))
	}

	incr(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('incr', () => this.client.incr(k))
	}

	incrBy(key: string, by: number): Promise<number> {
		const k = this.key(key)
		return this.track('incrBy', () => this.client.incrBy(k, by))
	}

	decr(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('decr', () => this.client.decr(k))
	}

	decrBy(key: string, by: number): Promise<number> {
		const k = this.key(key)
		return this.track('decrBy', () => this.client.decrBy(k, by))
	}

	async incrWithTTL(key: string, ttlSeconds: number): Promise<number> {
		const reply = await this.scripts.get('incrWithTTL').run(this.client, {
			keys: [this.key(key)],
			arguments: [String(ttlSeconds)],
		})
		return Number(reply)
	}

	mGet(keys: string[]): Promise<(string | null)[]> {
		if (keys.length === 0) return Promise.resolve([])
		const built = new Array<string>(keys.length)
		for (let i = 0; i < keys.length; i++) built[i] = this.key(keys[i])
		if (!this.onCommand) return this.client.mGet(built) as Promise<(string | null)[]>
		return this.track('mGet', () => this.client.mGet(built) as Promise<(string | null)[]>)
	}

	mSet(entries: Record<string, string | number>): Promise<string> {
		const mapped: Record<string, string> = {}
		for (const [k, v] of Object.entries(entries)) {
			mapped[this.key(k)] = typeof v === 'string' ? v : String(v)
		}
		if (!this.onCommand) return this.client.mSet(mapped) as Promise<string>
		return this.track('mSet', () => this.client.mSet(mapped) as Promise<string>)
	}

	hSet(key: string, field: string, value: string | number): Promise<number>
	hSet(key: string, values: Record<string, string | number>): Promise<number>
	hSet(
		key: string,
		fieldOrValues: string | Record<string, string | number>,
		value?: string | number,
	): Promise<number> {
		const k = this.key(key)
		if (typeof fieldOrValues === 'string') {
			return this.track('hSet', () => this.client.hSet(k, fieldOrValues, value as string | number))
		}
		return this.track('hSet', () => this.client.hSet(k, fieldOrValues))
	}

	hGet(key: string, field: string): Promise<string | null> {
		const k = this.key(key)
		return this.track('hGet', () => this.client.hGet(k, field) as unknown as Promise<string | null>)
	}

	hGetAll(key: string): Promise<Record<string, string>> {
		const k = this.key(key)
		return this.track('hGetAll', () => this.client.hGetAll(k) as unknown as Promise<Record<string, string>>)
	}

	hDel(key: string, field: string | string[]): Promise<number> {
		const k = this.key(key)
		return this.track('hDel', () => this.client.hDel(k, field))
	}

	async hExists(key: string, field: string): Promise<boolean> {
		const k = this.key(key)
		return Boolean(await this.track('hExists', () => this.client.hExists(k, field)))
	}

	hIncrBy(key: string, field: string, by: number): Promise<number> {
		const k = this.key(key)
		return this.track('hIncrBy', () => this.client.hIncrBy(k, field, by))
	}

	hKeys(key: string): Promise<string[]> {
		const k = this.key(key)
		return this.track('hKeys', () => this.client.hKeys(k) as unknown as Promise<string[]>)
	}

	hVals(key: string): Promise<string[]> {
		const k = this.key(key)
		return this.track('hVals', () => this.client.hVals(k) as unknown as Promise<string[]>)
	}

	hLen(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('hLen', () => this.client.hLen(k))
	}

	lPush(key: string, values: string | string[]): Promise<number> {
		const k = this.key(key)
		return this.track('lPush', () => this.client.lPush(k, values))
	}

	lPushBinary(key: string, value: Buffer): Promise<number> {
		const k = this.key(key)
		return this.track('lPush', () => this.client.lPush(k, value as unknown as string))
	}

	rPush(key: string, values: string | string[]): Promise<number> {
		const k = this.key(key)
		return this.track('rPush', () => this.client.rPush(k, values))
	}

	rPushBinary(key: string, value: Buffer): Promise<number> {
		const k = this.key(key)
		return this.track('rPush', () => this.client.rPush(k, value as unknown as string))
	}

	lPop(key: string): Promise<string | null> {
		const k = this.key(key)
		return this.track('lPop', () => this.client.lPop(k) as unknown as Promise<string | null>)
	}

	rPop(key: string): Promise<string | null> {
		const k = this.key(key)
		return this.track('rPop', () => this.client.rPop(k) as unknown as Promise<string | null>)
	}

	lRange(key: string, start: number, stop: number): Promise<string[]> {
		const k = this.key(key)
		return this.track('lRange', () => this.client.lRange(k, start, stop) as unknown as Promise<string[]>)
	}

	lLen(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('lLen', () => this.client.lLen(k))
	}

	lTrim(key: string, start: number, stop: number): Promise<string> {
		const k = this.key(key)
		return this.track('lTrim', () => this.client.lTrim(k, start, stop) as unknown as Promise<string>)
	}

	async popN(key: string, count: number): Promise<string[]> {
		const reply = (await this.scripts.get('popN').run(this.client, {
			keys: [this.key(key)],
			arguments: [String(count)],
		})) as unknown
		if (!Array.isArray(reply)) return []
		return reply.map((v) => String(v))
	}

	sAdd(key: string, members: string | string[]): Promise<number> {
		const k = this.key(key)
		return this.track('sAdd', () => this.client.sAdd(k, members))
	}

	sRem(key: string, members: string | string[]): Promise<number> {
		const k = this.key(key)
		return this.track('sRem', () => this.client.sRem(k, members))
	}

	sMembers(key: string): Promise<string[]> {
		const k = this.key(key)
		return this.track('sMembers', () => this.client.sMembers(k) as unknown as Promise<string[]>)
	}

	async sIsMember(key: string, member: string): Promise<boolean> {
		const k = this.key(key)
		return Boolean(await this.track('sIsMember', () => this.client.sIsMember(k, member)))
	}

	sCard(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('sCard', () => this.client.sCard(k))
	}

	zAdd(
		key: string,
		members:
			| { score: number; value: string }
			| { score: number; value: string }[],
	): Promise<number> {
		const k = this.key(key)
		return this.track('zAdd', () => this.client.zAdd(k, members))
	}

	zRem(key: string, members: string | string[]): Promise<number> {
		const k = this.key(key)
		return this.track('zRem', () => this.client.zRem(k, members))
	}

	zRange(key: string, start: number, stop: number): Promise<string[]> {
		const k = this.key(key)
		return this.track('zRange', () => this.client.zRange(k, start, stop) as unknown as Promise<string[]>)
	}

	zRangeByScore(key: string, min: number | string, max: number | string): Promise<string[]> {
		const k = this.key(key)
		return this.track('zRangeByScore', () => this.client.zRangeByScore(k, min, max) as unknown as Promise<string[]>)
	}

	zScore(key: string, member: string): Promise<number | null> {
		const k = this.key(key)
		return this.track('zScore', () => this.client.zScore(k, member) as unknown as Promise<number | null>)
	}

	zIncrBy(key: string, by: number, member: string): Promise<number> {
		const k = this.key(key)
		return this.track('zIncrBy', () => this.client.zIncrBy(k, by, member) as unknown as Promise<number>)
	}

	zCard(key: string): Promise<number> {
		const k = this.key(key)
		return this.track('zCard', () => this.client.zCard(k))
	}

	publish(channel: string, message: string | Buffer): Promise<number> {
		const c = this.key(channel)
		return this.track('publish', () => this.client.publish(c, message as string))
	}

	multi(): ReturnType<RedisClient['multi']> {
		return this.client.multi()
	}

	async getAndTouch(key: string, ttlSeconds: number): Promise<string | null> {
		const reply = await this.scripts.get('getAndTouch').run(this.client, {
			keys: [this.key(key)],
			arguments: [String(ttlSeconds)],
		})
		if (reply === null || reply === undefined) return null
		return String(reply)
	}

	async compareAndSet(
		key: string,
		expected: string,
		next: string | Buffer,
		ttlMs?: number,
	): Promise<boolean> {
		const reply = await this.scripts.get('compareAndSet').run(this.client, {
			keys: [this.key(key)],
			arguments: [expected, next as string, ttlMs ? String(ttlMs) : ''],
		})
		return Number(reply) === 1
	}

	async compareAndDel(key: string, expected: string): Promise<boolean> {
		const reply = await this.scripts.get('compareAndDel').run(this.client, {
			keys: [this.key(key)],
			arguments: [expected],
		})
		return Number(reply) > 0
	}

	async *scanKeys(
		matchPattern: string,
		count: number = SCAN_BATCH_DEFAULT,
	): AsyncGenerator<string> {
		const match = this.key(matchPattern)
		let cursor: string = '0'
		do {
			const reply = (await this.client.scan(cursor, {
				MATCH: match,
				COUNT: count,
			})) as unknown as { cursor: string | number; keys: (string | Buffer)[] }
			cursor = String(reply.cursor)
			for (const k of reply.keys) {
				yield String(k)
			}
		} while (cursor !== '0')
	}

	async delByPattern(
		matchPattern: string,
		options: DelByPatternOptions = {},
	): Promise<number> {
		if (this.namespace.length === 0 && !options.confirm) {
			throw new KVServiceError(
				'delByPattern called on an unnamespaced KVService without confirm: true (refusing to risk cross-app deletion)',
			)
		}
		let total = 0
		let batch: string[] = []
		let inflight: Promise<number> | null = null
		for await (const key of this.scanKeys(matchPattern, 1000)) {
			batch.push(key)
			if (batch.length >= DEL_BATCH_LIMIT) {
				if (inflight) total += await inflight
				inflight = this.client.del(batch)
				batch = []
			}
		}
		if (inflight) total += await inflight
		if (batch.length > 0) {
			total += await this.client.del(batch)
		}
		return total
	}

	rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
		return this.rateLimiter.fixedWindow(key, limit, windowSeconds)
	}

	slidingWindow(key: string, limit: number, windowMs: number) {
		return this.rateLimiter.slidingWindow(key, limit, windowMs)
	}

	tokenBucket(key: string, capacity: number, refillPerSecond: number, cost = 1) {
		return this.rateLimiter.tokenBucket(key, capacity, refillPerSecond, cost)
	}

	incrCapped(key: string, delta: number, max: number, ttlSeconds?: number) {
		return this.rateLimiter.incrCapped(key, delta, max, ttlSeconds)
	}

	tryWithLock<T>(
		key: string,
		ttlMs: number,
		fn: (handle: LockHandle) => Promise<T>,
	): Promise<T | null> {
		return this.locker.tryWithLock(key, ttlMs, fn)
	}

	withLock<T>(
		key: string,
		ttlMs: number,
		fn: (handle: LockHandle) => Promise<T>,
		options?: WithLockOptions,
	): Promise<T> {
		return this.locker.withLock(key, ttlMs, fn, options)
	}

	extendLock(key: string, token: string, ttlMs: number): Promise<boolean> {
		return this.locker.extendLock(key, token, ttlMs)
	}

	addScore(boardKey: string, member: string, score: number): Promise<number> {
		return this.leaderboard.addScore(boardKey, member, score)
	}

	incrScore(boardKey: string, member: string, delta: number): Promise<number> {
		return this.leaderboard.incrScore(boardKey, member, delta)
	}

	addScoreAndRank(boardKey: string, member: string, score: number) {
		return this.leaderboard.addScoreAndRank(boardKey, member, score)
	}

	topN(boardKey: string, count: number): Promise<LeaderboardEntry[]> {
		return this.leaderboard.topN(boardKey, count)
	}

	rankOf(boardKey: string, member: string) {
		return this.leaderboard.rankOf(boardKey, member)
	}

	setValue(type: string, key: string, message: object, options?: SetOptions) {
		return this.objects.setValue(type, key, message, options as never)
	}

	getValue<T = unknown>(type: string, key: string) {
		return this.objects.getValue<T>(type, key)
	}

	swapValue<T = unknown>(type: string, key: string, next: object) {
		return this.objects.swapValue<T>(type, key, next)
	}

	mGetValue<T = unknown>(type: string, keys: string[]) {
		return this.objects.mGetValue<T>(type, keys)
	}

	rememberValue<T extends object>(type: string, key: string, ttlSeconds: number, factory: () => Promise<T> | T) {
		return this.objects.rememberValue(type, key, ttlSeconds, factory)
	}

	enqueueValue(type: string, queueKey: string, message: object) {
		return this.objects.enqueueValue(type, queueKey, message)
	}

	dequeueValue<T = unknown>(type: string, queueKey: string) {
		return this.objects.dequeueValue<T>(type, queueKey)
	}

	dequeueValueBlocking<T = unknown>(type: string, queueKey: string, timeoutSeconds: number) {
		return this.objects.dequeueValueBlocking<T>(type, queueKey, timeoutSeconds)
	}

	publishValue(type: string, channel: string, message: object) {
		return this.objects.publishValue(type, channel, message)
	}

	subscribeValue<T = unknown>(
		type: string,
		channel: string,
		handler: SubscribeHandler<T>,
	): Promise<Subscription> {
		return this.objects.subscribeValue(type, channel, handler)
	}

	getAndTouchValue<T = unknown>(type: string, key: string, ttlSeconds: number) {
		return this.objects.getAndTouchValue<T>(type, key, ttlSeconds)
	}

	popNValue<T = unknown>(type: string, queueKey: string, count: number) {
		return this.objects.popNValue<T>(type, queueKey, count)
	}

	versionedSet(key: string, expectedVersion: number, data: string | Buffer, ttlSeconds?: number) {
		return this.versioned.set(key, expectedVersion, data, ttlSeconds)
	}

	versionedSetValue(type: string, key: string, expectedVersion: number, message: object, ttlSeconds?: number) {
		return this.versioned.setValue(type, key, expectedVersion, message, ttlSeconds)
	}

	versionedGet(key: string) {
		return this.versioned.get(key)
	}

	versionedGetValue<T = unknown>(type: string, key: string) {
		return this.versioned.getValue<T>(type, key)
	}

	encode(type: string, message: object): Buffer {
		return this.objects.encode(type, message)
	}

	decode<T = unknown>(type: string, buf: Buffer | Uint8Array): T {
		return this.objects.decode<T>(type, buf)
	}
}

export { KV_LUA_SCRIPTS }
