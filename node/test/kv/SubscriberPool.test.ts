import { describe, it, expect, vi } from 'vitest'
import { SubscriberPool } from '../../src/kv/SubscriberPool'

type RawHandler = (message: Buffer, channel: Buffer) => void

function makeFakeClient() {
	const listeners: Record<string, Array<() => void>> = {}
	const subscriptions = new Map<string, RawHandler>()
	let open = true

	const client = {
		get isOpen() { return open },
		connect: vi.fn(async () => { open = true }),
		quit: vi.fn(async () => { open = false }),
		on: vi.fn((event: string, cb: () => void) => {
			if (!listeners[event]) listeners[event] = []
			listeners[event].push(cb)
			return client
		}),
		subscribe: vi.fn(async (channel: string, listener: RawHandler, _buf: true) => {
			subscriptions.set(channel, listener)
		}),
		unsubscribe: vi.fn(async (channel: string) => {
			subscriptions.delete(channel)
		}),
		emit(event: string) {
			for (const cb of listeners[event] ?? []) cb()
		},
		getSubscription(channel: string) { return subscriptions.get(channel) },
		hasSubscription(channel: string) { return subscriptions.has(channel) },
		simulateDisconnect() { open = false },
	}
	return client
}

describe('SubscriberPool', () => {

	it('subscribes and delivers messages', async () => {
		const fakeClient = makeFakeClient()
		const pool = new SubscriberPool(() => fakeClient as never)

		const received: Buffer[] = []
		await pool.subscribeRaw('ch', (msg) => received.push(msg))

		const listener = fakeClient.getSubscription('ch')!
		listener(Buffer.from('hello'), Buffer.from('ch'))

		expect(received).toHaveLength(1)
		expect(received[0].toString()).toBe('hello')
	})

	it('resubscribes all channels on reconnect (ready event)', async () => {
		const fakeClient = makeFakeClient()
		const pool = new SubscriberPool(() => fakeClient as never)

		await pool.subscribeRaw('a', vi.fn())
		await pool.subscribeRaw('b', vi.fn())

		expect(fakeClient.subscribe).toHaveBeenCalledTimes(2)

		// Simulate drop then reconnect
		fakeClient.simulateDisconnect()
		fakeClient.subscribe.mockClear()

		// Trigger the ready event (as redis client would on reconnect)
		fakeClient.emit('ready')

		expect(fakeClient.subscribe).toHaveBeenCalledTimes(2)
		expect(fakeClient.hasSubscription('a')).toBe(true)
		expect(fakeClient.hasSubscription('b')).toBe(true)
	})

	it('uses this.connection (not stale client) for unsubscribe after reconnect', async () => {
		let clientCount = 0
		const clients: ReturnType<typeof makeFakeClient>[] = []

		const pool = new SubscriberPool(() => {
			const c = makeFakeClient()
			clients.push(c)
			clientCount++
			return c as never
		})

		const sub = await pool.subscribeRaw('ch', vi.fn())
		const firstClient = clients[0]
		expect(firstClient.subscribe).toHaveBeenCalledWith('ch', expect.any(Function), true)

		// Force pool to rebuild connection on next ensureConnection
		firstClient.simulateDisconnect()
		// Pool-level close to reset connection reference
		// (simulating a full reconnect by clearing the pool's connection)
		await pool.close()

		// Second subscription will create a new client
		const handler2 = vi.fn()
		await pool.subscribeRaw('ch', handler2)
		expect(clients).toHaveLength(2)
		const secondClient = clients[1]

		// Now close the original subscription — must call unsubscribe on the live connection
		// (the second client), not on the first (stale) one
		// The original sub's close() should reference this.connection, which is secondClient
		await sub.close()

		expect(firstClient.unsubscribe).not.toHaveBeenCalled()
		// handler2 is still registered so the channel is not unsubscribed yet
		expect(secondClient.unsubscribe).not.toHaveBeenCalled()
	})

	it('concurrent subscribeRaw during last-subscription teardown does not lose its subscription', async () => {
		const fakeClient = makeFakeClient()
		const pool = new SubscriberPool(() => fakeClient as never)

		const handlerA = vi.fn()
		const handlerB = vi.fn()

		const subA = await pool.subscribeRaw('ch', handlerA)

		// Start closing A and starting B concurrently.
		// subA.close() will try to teardown the connection when entries reach 0.
		// subscribeRaw('ch', handlerB) must complete successfully despite the race.
		const [, subB] = await Promise.all([
			subA.close(),
			pool.subscribeRaw('ch', handlerB),
		])

		// B's subscription must be registered
		expect(fakeClient.hasSubscription('ch')).toBe(true)

		// The connection must not have been quit while B is active
		expect(fakeClient.quit).not.toHaveBeenCalled()

		// Messages must reach handler B
		const listener = fakeClient.getSubscription('ch')!
		listener(Buffer.from('msg'), Buffer.from('ch'))
		expect(handlerB).toHaveBeenCalledTimes(1)

		// Clean up
		await subB.close()
	})

	it('closes connection when last subscription is removed and no pending subscribes', async () => {
		const fakeClient = makeFakeClient()
		const pool = new SubscriberPool(() => fakeClient as never)

		const sub = await pool.subscribeRaw('ch', vi.fn())
		await sub.close()

		expect(fakeClient.quit).toHaveBeenCalledTimes(1)
	})

	it('two handlers on same channel share one redis subscription', async () => {
		const fakeClient = makeFakeClient()
		const pool = new SubscriberPool(() => fakeClient as never)

		const h1 = vi.fn()
		const h2 = vi.fn()
		const sub1 = await pool.subscribeRaw('ch', h1)
		const sub2 = await pool.subscribeRaw('ch', h2)

		expect(fakeClient.subscribe).toHaveBeenCalledTimes(1)

		const listener = fakeClient.getSubscription('ch')!
		listener(Buffer.from('x'), Buffer.from('ch'))
		expect(h1).toHaveBeenCalledTimes(1)
		expect(h2).toHaveBeenCalledTimes(1)

		await sub1.close()
		expect(fakeClient.unsubscribe).not.toHaveBeenCalled()
		await sub2.close()
		expect(fakeClient.unsubscribe).toHaveBeenCalledWith('ch')
	})

	it('ensureConnection rebuilds when existing connection is not open', async () => {
		let callCount = 0
		const clients: ReturnType<typeof makeFakeClient>[] = []
		const pool = new SubscriberPool(() => {
			callCount++
			const c = makeFakeClient()
			clients.push(c)
			return c as never
		})

		await pool.subscribeRaw('ch', vi.fn())
		expect(callCount).toBe(1)

		// Drain the pool so connection is cleaned up
		const sub = await pool.subscribeRaw('ch2', vi.fn())
		// Close all to null out connection
		await pool.close()

		// Connection is now null; next subscribeRaw must create a new client
		await pool.subscribeRaw('ch', vi.fn())
		expect(callCount).toBe(2)
	})

})
