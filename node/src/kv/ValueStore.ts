import type Serializer from '@toolcase/serializer'
import { RESP_TYPES } from 'redis'
import { KVServiceError } from '../errors'
import { KeyBuilder } from './keys'
import type { Locker } from './Locker'
import { LuaScriptCache } from './scripts'
import type { SubscriberPool } from './SubscriberPool'
import type { RedisClient, SubscribeHandler, Subscription } from './types'

interface BufferClient {
	get: (key: string) => Promise<Buffer | null>
	set: (key: string, value: Buffer | string, options?: unknown) => Promise<unknown>
	mGet: (keys: string[]) => Promise<(Buffer | null)[]>
	rPop: (key: string) => Promise<Buffer | null>
	brPop: (key: string, timeoutSeconds: number) => Promise<{ key: Buffer | string; element: Buffer } | null>
	hGetAll: (key: string) => Promise<Record<string, Buffer>>
	eval: (script: string, options: { keys: string[]; arguments: string[] }) => Promise<unknown>
	evalSha: (sha: string, options: { keys: string[]; arguments: string[] }) => Promise<unknown>
}

export class ValueStore {

	private readonly bufferClient: BufferClient

	constructor(
		private readonly client: RedisClient,
		private readonly keys: KeyBuilder,
		private readonly scripts: LuaScriptCache,
		private readonly serializer: Serializer | undefined,
		private readonly subscribers?: SubscriberPool,
		bufferClient?: unknown,
		private readonly locker?: Locker,
	) {
		if (serializer !== undefined) {
			const s = serializer as unknown as { encode?: unknown; decode?: unknown }
			if (typeof s.encode !== 'function' || typeof s.decode !== 'function') {
				throw new KVServiceError(
					'ValueStore: serializer must expose encode() and decode() methods',
				)
			}
		}
		if (bufferClient) {
			this.bufferClient = bufferClient as BufferClient
			return
		}
		const withTypeMapping = (this.client as unknown as {
			withTypeMapping?: (mapping: Record<number, unknown>) => RedisClient
		}).withTypeMapping
		if (typeof withTypeMapping !== 'function') {
			throw new KVServiceError(
				'redis client does not support withTypeMapping (requires node-redis v5+)',
			)
		}
		this.bufferClient = withTypeMapping.call(this.client, {
			[RESP_TYPES.BLOB_STRING]: Buffer,
		}) as unknown as BufferClient
	}

	private requireSerializer(): Serializer {
		if (!this.serializer) {
			throw new KVServiceError('serializer is not configured')
		}
		return this.serializer
	}

	private toBuffer(buf: Uint8Array): Buffer {
		return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
	}

	private toUint8(buf: Buffer): Uint8Array {
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
	}

	encode(type: string, message: object): Buffer {
		return this.toBuffer(this.requireSerializer().encode(type, message))
	}

	decode<T = unknown>(type: string, buf: Buffer | Uint8Array): T {
		const u8 = buf instanceof Buffer ? this.toUint8(buf) : buf
		return this.requireSerializer().decode(type, u8) as unknown as T
	}

	setValue(
		type: string,
		key: string,
		message: object,
		options?: { EX?: number; PX?: number; NX?: boolean; XX?: boolean },
	): Promise<string | null> {
		return this.client.set(
			this.keys.build(key),
			this.encode(type, message),
			options as never,
		) as unknown as Promise<string | null>
	}

	async getValue<T = unknown>(type: string, key: string): Promise<T | null> {
		const buf = await this.bufferClient.get(this.keys.build(key))
		if (buf === null) return null
		return this.decode<T>(type, buf)
	}

	async swapValue<T = unknown>(
		type: string,
		key: string,
		next: object,
	): Promise<T | null> {
		const reply = (await this.bufferClient.set(
			this.keys.build(key),
			this.encode(type, next),
			{ GET: true },
		)) as Buffer | null
		if (reply === null) return null
		return this.decode<T>(type, reply)
	}

	async mGetValue<T = unknown>(
		type: string,
		keys: string[],
	): Promise<(T | null)[]> {
		if (keys.length === 0) return []
		const built = new Array<string>(keys.length)
		for (let i = 0; i < keys.length; i++) built[i] = this.keys.build(keys[i])
		const rows = await this.bufferClient.mGet(built)
		const out = new Array<T | null>(rows.length)
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i]
			out[i] = r === null ? null : this.decode<T>(type, r)
		}
		return out
	}

	async rememberValue<T extends object>(
		type: string,
		key: string,
		ttlSeconds: number,
		factory: () => Promise<T> | T,
	): Promise<T> {
		const cached = await this.getValue<T>(type, key)
		if (cached !== null) return cached
		if (!this.locker) {
			const value = await factory()
			await this.setValue(type, key, value, { EX: ttlSeconds })
			return value
		}
		return this.locker.withLock(
			this.keys.build('remember', type, key),
			30_000,
			async (_handle) => {
				const again = await this.getValue<T>(type, key)
				if (again !== null) return again
				const value = await factory()
				await this.setValue(type, key, value, { EX: ttlSeconds })
				return value
			},
		)
	}

	enqueueValue(type: string, queueKey: string, message: object): Promise<number> {
		const buf = this.encode(type, message)
		return this.client.lPush(this.keys.build(queueKey), buf as unknown as string)
	}

	async dequeueValue<T = unknown>(
		type: string,
		queueKey: string,
	): Promise<T | null> {
		const buf = await this.bufferClient.rPop(this.keys.build(queueKey))
		if (buf === null) return null
		return this.decode<T>(type, buf)
	}

	async dequeueValueBlocking<T = unknown>(
		type: string,
		queueKey: string,
		timeoutSeconds: number,
	): Promise<T | null> {
		const reply = await this.bufferClient.brPop(this.keys.build(queueKey), timeoutSeconds)
		if (reply === null) return null
		const element =
			reply.element instanceof Buffer ? reply.element : Buffer.from(reply.element)
		return this.decode<T>(type, element)
	}

	publishValue(
		type: string,
		channel: string,
		message: object,
	): Promise<number> {
		const buf = this.encode(type, message)
		return this.client.publish(this.keys.build(channel), buf)
	}

	async subscribeValue<T = unknown>(
		type: string,
		channel: string,
		handler: SubscribeHandler<T>,
	): Promise<Subscription> {
		if (!this.subscribers) {
			throw new KVServiceError(
				'subscribeValue requires a SubscriberPool — construct ValueStore via KVService',
			)
		}
		const fullChannel = this.keys.build(channel)
		const serializer = this.requireSerializer()
		return this.subscribers.subscribeRaw(fullChannel, (message, channelBuf) => {
			const decoded = serializer.decode(type, this.toUint8(message)) as T
			const channelName = channelBuf.toString('utf8')
			const stripped = this.keys.stripNamespace(channelName)
			void handler(decoded, stripped)
		})
	}

	async getAndTouchValue<T = unknown>(
		type: string,
		key: string,
		ttlSeconds: number,
	): Promise<T | null> {
		const reply = (await this.scripts.get('getAndTouch').run(this.bufferClient as unknown as RedisClient, {
			keys: [this.keys.build(key)],
			arguments: [String(ttlSeconds)],
		})) as Buffer | null
		if (reply === null) return null
		return this.decode<T>(type, reply)
	}

	async popNValue<T = unknown>(
		type: string,
		queueKey: string,
		count: number,
	): Promise<T[]> {
		const reply = (await this.scripts.get('popN').run(this.bufferClient as unknown as RedisClient, {
			keys: [this.keys.build(queueKey)],
			arguments: [String(count)],
		})) as unknown
		if (!Array.isArray(reply)) return []
		const out = new Array<T>(reply.length)
		for (let i = 0; i < reply.length; i++) {
			out[i] = this.decode<T>(type, reply[i] as Buffer)
		}
		return out
	}
}
