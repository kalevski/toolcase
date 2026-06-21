import { describe, it, expect, vi } from 'vitest'
import { ValueStore } from '../../src/kv/ValueStore'
import { Locker } from '../../src/kv/Locker'
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../src/kv/keys'
import { LuaScriptCache } from '../../src/kv/scripts'

const serializer = {
	encode: (_type: string, msg: object): Uint8Array =>
		new TextEncoder().encode(JSON.stringify(msg)),
	decode: (_type: string, buf: Uint8Array): unknown =>
		JSON.parse(new TextDecoder().decode(buf)),
}

function makeInMemClient() {
	const dataStore = new Map<string, Buffer>()
	const lockStore = new Map<string, string>() // lockKey → token

	const evalSha = vi.fn(async (_sha: string, opts: { keys: string[]; arguments: string[] }) => {
		const [key] = opts.keys
		const [token] = opts.arguments
		if (opts.arguments.length === 1) {
			if (lockStore.get(key) === token) { lockStore.delete(key); return 1 }
			return 0
		}
		return lockStore.get(key) === token ? 1 : 0
	})

	const client = {
		set: vi.fn(async (key: string, value: string | Buffer, opts?: Record<string, unknown>) => {
			if (opts?.NX) {
				if (lockStore.has(key)) return null
				lockStore.set(key, String(value))
				return 'OK'
			}
			dataStore.set(key, value instanceof Buffer ? value : Buffer.from(String(value)))
			return 'OK'
		}),
		evalSha,
		eval: vi.fn(async (_script: string, opts: { keys: string[]; arguments: string[] }) =>
			evalSha('', opts),
		),
		lPush: vi.fn(),
		publish: vi.fn(),
		get: vi.fn(async (key: string) => dataStore.get(key) ?? null),
	}

	const bufferClient = {
		get: vi.fn(async (key: string) => dataStore.get(key) ?? null),
		set: vi.fn(async (key: string, value: Buffer) => {
			dataStore.set(key, value)
			return 'OK'
		}),
		mGet: vi.fn(async () => []),
		rPop: vi.fn(async () => null),
		brPop: vi.fn(async () => null),
		hGetAll: vi.fn(async () => ({})),
		eval: vi.fn(async () => null),
		evalSha: vi.fn(async () => null),
	}

	return { client, bufferClient, dataStore, lockStore }
}

function makeValueStore() {
	const { client, bufferClient } = makeInMemClient()
	const keys = new KeyBuilder('test', KV_KEY_SEPARATOR)
	const scripts = new LuaScriptCache()
	const locker = new Locker(client as never, keys, scripts)
	const vs = new ValueStore(
		client as never,
		keys,
		scripts,
		serializer as never,
		undefined,
		bufferClient,
		locker,
	)
	return { vs, client, bufferClient }
}

describe('ValueStore.rememberValue', () => {

	it('returns the cached value on a warm key without calling the factory', async () => {
		const { vs } = makeValueStore()
		await vs.setValue('T', 'k', { n: 1 }, { EX: 60 })
		let calls = 0
		const result = await vs.rememberValue('T', 'k', 60, () => { calls++; return { n: 99 } })
		expect(calls).toBe(0)
		expect(result).toEqual({ n: 1 })
	})

	it('calls factory once and stores result on a cold key', async () => {
		const { vs } = makeValueStore()
		let calls = 0
		const result = await vs.rememberValue('T', 'cold', 60, async () => {
			calls++
			return { x: 42 }
		})
		expect(calls).toBe(1)
		expect(result).toEqual({ x: 42 })
		// Subsequent call should hit cache
		const again = await vs.rememberValue('T', 'cold', 60, () => { calls++; return { x: 0 } })
		expect(calls).toBe(1)
		expect(again).toEqual({ x: 42 })
	})

	it('fires factory exactly once with N concurrent callers on a cold key', async () => {
		const { vs } = makeValueStore()
		const N = 5
		let factoryCount = 0
		const factory = async (): Promise<{ result: string }> => {
			factoryCount++
			return { result: 'computed' }
		}

		const results = await Promise.all(
			Array.from({ length: N }, () => vs.rememberValue('T', 'shared', 60, factory)),
		)

		expect(factoryCount).toBe(1)
		expect(results).toHaveLength(N)
		for (const r of results) {
			expect(r).toEqual({ result: 'computed' })
		}
	}, 10_000)

	it('skips factory inside lock when a concurrent caller already populated the key', async () => {
		const { vs } = makeValueStore()

		let getCallCount = 0
		const originalGet = vs.getValue.bind(vs)
		vi.spyOn(vs, 'getValue').mockImplementation(async (type, key) => {
			getCallCount++
			// First call (pre-lock check): cold miss
			if (getCallCount === 1) return null
			// Second call (recheck inside lock): value already present
			if (getCallCount === 2) {
				await vs.setValue(type, key, { prefilled: true }, { EX: 60 })
				return originalGet(type, key)
			}
			return originalGet(type, key)
		})

		let factoryCount = 0
		const result = await vs.rememberValue('T', 'race', 60, () => {
			factoryCount++
			return { prefilled: false }
		})

		expect(factoryCount).toBe(0)
		expect(result).toEqual({ prefilled: true })
	})

})
