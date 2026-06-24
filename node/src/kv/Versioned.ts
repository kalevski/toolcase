import type Serializer from '@toolcase/serializer'
import { RESP_TYPES } from 'redis'
import { KVServiceError } from '../errors'
import { KeyBuilder } from './keys'
import { LuaScriptCache } from './scripts'
import type { RedisClient } from './types'

interface BufferHashClient {
	hGetAll: (key: string) => Promise<Record<string, Buffer>>
}

export class Versioned {

	private readonly bufferClient: BufferHashClient

	constructor(
		private readonly client: RedisClient,
		private readonly keys: KeyBuilder,
		private readonly scripts: LuaScriptCache,
		private readonly serializer: Serializer | undefined,
		bufferClient?: unknown,
	) {
		if (bufferClient) {
			this.bufferClient = bufferClient as BufferHashClient
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
		}) as unknown as BufferHashClient
	}

	private toBuffer(buf: Uint8Array): Buffer {
		return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
	}

	private toUint8(buf: Buffer): Uint8Array {
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
	}

	async set(
		key: string,
		expectedVersion: number,
		data: string | Buffer,
		ttlSeconds?: number,
	): Promise<{ ok: boolean; version: number }> {
		const reply = (await this.scripts.get('versionedSet').run(this.client, {
			keys: [this.keys.build(key)],
			arguments: [
				String(expectedVersion),
				data as string,
				ttlSeconds ? String(ttlSeconds) : '',
			],
		})) as [number, number]
		const ok = Number(reply[0])
		const ver = Number(reply[1])
		if (ok === 0 && ver === -1) {
			throw new KVServiceError(
				`versionedSet: key '${key}' already exists as a foreign hash (missing __vset marker)`,
			)
		}
		return { ok: ok === 1, version: ver }
	}

	async setValue(
		type: string,
		key: string,
		expectedVersion: number,
		message: object,
		ttlSeconds?: number,
	): Promise<{ ok: boolean; version: number }> {
		if (!this.serializer) throw new KVServiceError('serializer is not configured')
		const buf = this.toBuffer(this.serializer.encode(type, message))
		return this.set(key, expectedVersion, buf, ttlSeconds)
	}

	async get(key: string): Promise<{ version: number; data: string } | null> {
		const data = (await this.client.hGetAll(this.keys.build(key))) as unknown as Record<string, string>
		if (!data || Object.keys(data).length === 0) return null
		return {
			version: Number(data.version ?? 0),
			data: data.data ?? '',
		}
	}

	async getValue<T = unknown>(
		type: string,
		key: string,
	): Promise<{ version: number; data: T } | null> {
		if (!this.serializer) throw new KVServiceError('serializer is not configured')
		const data = await this.bufferClient.hGetAll(this.keys.build(key))
		if (!data || Object.keys(data).length === 0) return null
		const versionRaw = data.version
		const dataRaw = data.data
		return {
			version: versionRaw ? Number(versionRaw.toString('utf8')) : 0,
			data: this.serializer.decode(type, this.toUint8(dataRaw)) as T,
		}
	}
}
