import { describe, it, expect } from 'vitest'
import { Versioned } from '../../src/kv/Versioned'
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../src/kv/keys'
import { LuaScriptCache } from '../../src/kv/scripts'
import { KVServiceError } from '../../src/errors'

// JavaScript re-implementation of LUA_VERSIONED_SET used to drive the in-memory
// mock. Kept in sync with the Lua in scripts.ts so unit tests exercise the same
// branching logic without requiring a live Redis connection.
function runVersionedSetLogic(
	hashStore: Map<string, Map<string, string>>,
	opts: { keys: string[]; arguments: string[] },
): [number, number] {
	const key = opts.keys[0]
	const [versionArg, data] = opts.arguments

	const hash = hashStore.get(key)
	const cur = hash?.get('version') ?? null
	const marker = hash?.get('__vset') ?? null
	const keyExists = hash !== undefined && hash.size > 0 ? 1 : 0

	// Foreign hash: key exists but has neither our version field nor our marker
	if (cur === null && marker === null && keyExists === 1) {
		return [0, -1]
	}

	// Version mismatch
	if (cur !== null && Number(cur) !== Number(versionArg)) {
		return [0, Number(cur)]
	}

	// Non-zero expected version on a non-existent key
	if (cur === null && Number(versionArg) !== 0) {
		return [0, 0]
	}

	const nextVersion = Number(versionArg) + 1
	if (!hashStore.has(key)) hashStore.set(key, new Map())
	const h = hashStore.get(key)!
	h.set('version', String(nextVersion))
	h.set('data', data)
	h.set('__vset', '1')

	return [1, nextVersion]
}

function makeVersionedStore() {
	const hashStore = new Map<string, Map<string, string>>()

	const evalImpl = async (_: string, opts: { keys: string[]; arguments: string[] }) =>
		runVersionedSetLogic(hashStore, opts)

	const client = {
		evalSha: evalImpl,
		eval: evalImpl,
		hGetAll: async (key: string): Promise<Record<string, string>> => {
			const hash = hashStore.get(key)
			if (!hash || hash.size === 0) return {}
			return Object.fromEntries(hash.entries())
		},
	}

	const bufferClient = {
		hGetAll: async (key: string): Promise<Record<string, Buffer>> => {
			const hash = hashStore.get(key)
			if (!hash || hash.size === 0) return {}
			const result: Record<string, Buffer> = {}
			for (const [k, v] of hash.entries()) result[k] = Buffer.from(v)
			return result
		},
	}

	const keys = new KeyBuilder('test', KV_KEY_SEPARATOR)
	const scripts = new LuaScriptCache()
	const versioned = new Versioned(
		client as never,
		keys,
		scripts,
		undefined,
		bufferClient,
	)

	function setForeignHash(key: string, fields: Record<string, string>): void {
		const fullKey = keys.build(key)
		hashStore.set(fullKey, new Map(Object.entries(fields)))
	}

	return { versioned, hashStore, keys, setForeignHash }
}

describe('Versioned.set — foreign hash guard', () => {

	it('refuses CAS with expectedVersion=0 when a foreign hash already occupies the key', async () => {
		const { versioned, setForeignHash } = makeVersionedStore()
		setForeignHash('item:1', { someOtherField: 'someValue' })

		await expect(
			versioned.set('item:1', 0, 'payload'),
		).rejects.toThrow(KVServiceError)

		await expect(
			versioned.set('item:1', 0, 'payload'),
		).rejects.toThrow(/foreign hash/)
	})

	it('refuses CAS with any expectedVersion when a foreign hash occupies the key', async () => {
		const { versioned, setForeignHash } = makeVersionedStore()
		setForeignHash('item:2', { unrelated: 'data', count: '5' })

		await expect(
			versioned.set('item:2', 3, 'payload'),
		).rejects.toThrow(KVServiceError)
	})

	it('succeeds on a brand-new key (expectedVersion=0)', async () => {
		const { versioned } = makeVersionedStore()
		const result = await versioned.set('item:new', 0, 'hello')
		expect(result.ok).toBe(true)
		expect(result.version).toBe(1)
	})

	it('sets __vset marker on first write so subsequent CAS is accepted', async () => {
		const { versioned, hashStore, keys } = makeVersionedStore()
		await versioned.set('item:seq', 0, 'v0')
		const hash = hashStore.get(keys.build('item:seq'))
		expect(hash?.get('__vset')).toBe('1')

		const next = await versioned.set('item:seq', 1, 'v1')
		expect(next.ok).toBe(true)
		expect(next.version).toBe(2)
	})

	it('returns ok=false with current version on a version mismatch (not a foreign-hash error)', async () => {
		const { versioned } = makeVersionedStore()
		await versioned.set('item:v', 0, 'init')
		const result = await versioned.set('item:v', 99, 'bad')
		expect(result.ok).toBe(false)
		expect(result.version).toBe(1)
	})

	it('returns ok=false when expectedVersion != 0 but key does not exist', async () => {
		const { versioned } = makeVersionedStore()
		const result = await versioned.set('item:ghost', 5, 'payload')
		expect(result.ok).toBe(false)
		expect(result.version).toBe(0)
	})

	it('is backward-compatible: existing versioned key without __vset marker is not treated as foreign', async () => {
		const { versioned, hashStore, keys } = makeVersionedStore()
		// Simulate a key written by the old code (has version but no __vset)
		hashStore.set(keys.build('item:old'), new Map([
			['version', '3'],
			['data', 'legacy'],
		]))

		const result = await versioned.set('item:old', 3, 'updated')
		expect(result.ok).toBe(true)
		expect(result.version).toBe(4)
	})

})
