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

	constructor(
		private readonly duplicate: () => RedisClient,
		private readonly onError?: SubscriberErrorHook,
	) {}

	private async ensureConnection(): Promise<RedisClient> {
		if (this.connection) return this.connection
		if (this.connecting) return this.connecting
		this.connecting = (async () => {
			const client = this.duplicate()
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

	async subscribeRaw(channel: string, handler: RawHandler): Promise<Subscription> {
		const client = await this.ensureConnection()
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

		let removed = false
		return {
			close: async () => {
				if (removed) return
				removed = true
				const current = this.entries.get(channel)
				if (!current) return
				current.handlers.delete(handler)
				if (current.handlers.size === 0) {
					this.entries.delete(channel)
					await (client as unknown as SubscriberCapableClient)
						.unsubscribe(channel)
						.catch(() => {})
				}
				if (this.entries.size === 0 && this.connection) {
					const conn = this.connection
					this.connection = null
					if (conn.isOpen) {
						await conn.quit().catch(() => {})
					}
				}
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
