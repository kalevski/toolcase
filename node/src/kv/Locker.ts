import { randomUUID } from 'node:crypto'
import { LockNotAcquiredError } from '../errors'
import { KeyBuilder } from './keys'
import { LuaScriptCache } from './scripts'
import type { RedisClient } from './types'

const LOCK_NAMESPACE = 'lock'

export interface LockHandle {
	token: string
	extend: (ttlMs: number) => Promise<boolean>
}

export interface WithLockOptions {
	retries?: number
	backoffMs?: number
	keepAliveMs?: number
}

export class Locker {

	constructor(
		private readonly client: RedisClient,
		private readonly keys: KeyBuilder,
		private readonly scripts: LuaScriptCache,
	) {}

	private lockKey(key: string): string {
		return this.keys.build(LOCK_NAMESPACE, key)
	}

	async tryWithLock<T>(
		key: string,
		ttlMs: number,
		fn: (handle: LockHandle) => Promise<T>,
	): Promise<T | null> {
		const lockKey = this.lockKey(key)
		const token = randomUUID()
		const acquired = await this.client.set(lockKey, token, { NX: true, PX: ttlMs })
		if (acquired === null) return null
		return this.runHeld(lockKey, token, ttlMs, fn, undefined)
	}

	async withLock<T>(
		key: string,
		ttlMs: number,
		fn: (handle: LockHandle) => Promise<T>,
		options: WithLockOptions = {},
	): Promise<T> {
		const retries = options.retries ?? 5
		const backoffMs = options.backoffMs ?? 50
		const lockKey = this.lockKey(key)
		const token = randomUUID()

		for (let attempt = 0; attempt <= retries; attempt++) {
			const acquired = await this.client.set(lockKey, token, { NX: true, PX: ttlMs })
			if (acquired !== null) {
				return this.runHeld(lockKey, token, ttlMs, fn, options.keepAliveMs)
			}
			if (attempt < retries) {
				const base = backoffMs * Math.pow(2, attempt)
				await sleep(base * (0.5 + Math.random() * 0.5))
			}
		}
		throw new LockNotAcquiredError(key)
	}

	async extendLock(key: string, token: string, ttlMs: number): Promise<boolean> {
		const reply = await this.scripts.get('extendLock').run(this.client, {
			keys: [this.lockKey(key)],
			arguments: [token, String(ttlMs)],
		})
		return Number(reply) === 1
	}

	private async runHeld<T>(
		lockKey: string,
		token: string,
		ttlMs: number,
		fn: (handle: LockHandle) => Promise<T>,
		keepAliveMs: number | undefined,
	): Promise<T> {
		let released = false
		const pending = new Set<Promise<unknown>>()
		const runExtend = (next: number): Promise<boolean> => {
			if (released) return Promise.resolve(false)
			const p = this.scripts.get('extendLock').run(this.client, {
				keys: [lockKey],
				arguments: [token, String(next)],
			}).then((reply) => Number(reply) === 1)
			pending.add(p)
			p.finally(() => pending.delete(p))
			return p
		}

		const handle: LockHandle = {
			token,
			extend: runExtend,
		}

		let timer: NodeJS.Timeout | null = null
		if (keepAliveMs && keepAliveMs > 0) {
			timer = setInterval(() => {
				void runExtend(ttlMs).catch(() => false)
			}, keepAliveMs)
		}

		try {
			return await fn(handle)
		} finally {
			released = true
			if (timer) clearInterval(timer)
			if (pending.size > 0) await Promise.allSettled(pending)
			await this.scripts.get('compareAndDel').run(this.client, {
				keys: [lockKey],
				arguments: [token],
			}).catch(() => 0)
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
