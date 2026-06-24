import type { RedisClient, Subscription } from './types'

type RawHandler = (message: Buffer, channel: Buffer) => void
export type SubscriberErrorHook = (error: unknown, channel: string) => void

interface ChannelEntry {
	handlers: Set<RawHandler>
	rootListener: RawHandler
}

interface SubscriberCapableClient {
	subscribe: (
		channel: string,
		listener: RawHandler,
		bufferMode: true,
	) => Promise<void>
	unsubscribe: (channel: string) => Promise<void>
}

export class SubscriberPool {

	private readonly entries = new Map<string, ChannelEntry>()
	private connection: RedisClient | null = null
	private connecting: Promise<RedisClient> | null = null
	private lockTail: Promise<void> = Promise.resolve()
	private pendingSubscribes = 0

	constructor(
		private readonly duplicate: () => RedisClient,
		private readonly onError?: SubscriberErrorHook,
	) {}

	private withLock<T>(fn: () => Promise<T>): Promise<T> {
		const current = this.lockTail
		let resolve!: () => void
		this.lockTail = new Promise<void>(r => (resolve = r))
		return current.then(() => fn()).finally(resolve) as Promise<T>
	}

	private async ensureConnection(): Promise<RedisClient> {
		if (this.connection?.isOpen) return this.connection
		if (this.connection && !this.connection.isOpen) {
			this.connection = null
		}
		if (this.connecting) return this.connecting
		this.connecting = (async () => {
			const client = this.duplicate()
			client.on('ready', () => this.resubscribeAll(client))
			await client.connect()
			this.connection = client
			return client
		})()
		try {
			return await this.connecting
		} finally {
			this.connecting = null
		}
	}

	private resubscribeAll(conn: RedisClient): void {
		const sub = conn as unknown as SubscriberCapableClient
		for (const [channel, entry] of this.entries) {
			sub.subscribe(channel, entry.rootListener, true).catch(() => {})
		}
	}

	async subscribeRaw(channel: string, handler: RawHandler): Promise<Subscription> {
		this.pendingSubscribes++
		try {
			const client = await this.ensureConnection()
			await this.withLock(async () => {
				let entry = this.entries.get(channel)
				if (!entry) {
					const handlers = new Set<RawHandler>()
					const onError = this.onError
					const rootListener: RawHandler = (message, channelBuf) => {
						for (const h of handlers) {
							try {
								h(message, channelBuf)
							} catch (error) {
								if (onError) onError(error, channel)
							}
						}
					}
					entry = { handlers, rootListener }
					this.entries.set(channel, entry)
					await (client as unknown as SubscriberCapableClient).subscribe(
						channel,
						rootListener,
						true,
					)
				}
				entry.handlers.add(handler)
			})
		} finally {
			this.pendingSubscribes--
		}

		let removed = false
		return {
			close: async () => {
				if (removed) return
				removed = true
				await this.withLock(async () => {
					const current = this.entries.get(channel)
					if (!current) return
					current.handlers.delete(handler)
					if (current.handlers.size === 0) {
						this.entries.delete(channel)
						if (this.connection) {
							await (this.connection as unknown as SubscriberCapableClient)
								.unsubscribe(channel)
								.catch(() => {})
						}
					}
					if (this.entries.size === 0 && this.pendingSubscribes === 0 && this.connection) {
						const conn = this.connection
						this.connection = null
						if (conn.isOpen) {
							await conn.quit().catch(() => {})
						}
					}
				})
			},
		}
	}

	async close(): Promise<void> {
		this.entries.clear()
		if (this.connection && this.connection.isOpen) {
			const conn = this.connection
			this.connection = null
			await conn.quit().catch(() => {})
		}
	}
}
