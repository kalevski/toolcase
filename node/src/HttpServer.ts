import fastify, { FastifyInstance } from 'fastify'
import cors, { type FastifyCorsOptions } from '@fastify/cors'
import { HTTP } from '@toolcase/base'
import { Logger } from './utils/logger'
import { normalizePrefix } from './utils/path'

const { RESTError, Status } = HTTP

export interface Routable {
	register(fastify: FastifyInstance): void
}

export type HealthCheck = () => Promise<unknown> | unknown

export interface HttpServerOptions {
	port: number
	host?: string
	prefix?: string
	cors?: FastifyCorsOptions | false
	trustProxy?: boolean
	healthCheck?: HealthCheck
	logger?: Logger
}

interface RoutableEntry {
	routable: Routable
	prefix?: string
}

/**
 * Reusable Fastify wrapper. Owns the server lifecycle (`init` → `run` →
 * `dispose`) and exposes a single composition surface: `add(routable, {
 * prefix? })` accepts anything with a `register(fastify)` method (an
 * `RouteHandler`, a `Router`, or any custom plugin-shaped object).
 *
 * `/health` is always mounted at the root path (never under `prefix`) and is
 * driven by an optional `healthCheck` callback. When the callback resolves,
 * the resolved value is sent back as the response body with HTTP 200; when it
 * throws or rejects, HTTP 503 + `{ status: 'degraded' }` is returned.
 */
export class HttpServer {

	private server!: FastifyInstance
	private readonly entries: RoutableEntry[] = []
	private readonly options: HttpServerOptions

	constructor(options: HttpServerOptions) {
		this.options = options
	}

	get instance(): FastifyInstance {
		return this.server
	}

	add(routable: Routable, options: { prefix?: string } = {}): this {
		this.entries.push({ routable, prefix: options.prefix })
		return this
	}

	async init(): Promise<void> {
		this.server = fastify({ trustProxy: this.options.trustProxy ?? true })

		if (this.options.cors !== false) {
			const corsOptions: FastifyCorsOptions = this.options.cors ?? {
				origin: false,
				credentials: false,
			}
			await this.server.register(cors, corsOptions)
		}

		this.server.get('/health', async (_req, reply) => {
			const check = this.options.healthCheck
			if (!check) {
				return reply.status(Status.OK).send({ status: 'ok' })
			}
			try {
				const result = await check()
				return reply.status(Status.OK).send(result)
			} catch (error) {
				this.options.logger?.error?.('health check failed', {
					error: (error as Error).message,
				})
				return reply.status(503).send({ status: 'degraded' })
			}
		})

		const versionPrefix = this.options.prefix
		for (const entry of this.entries) {
			const fullPrefix = combinePrefix(versionPrefix, entry.prefix)
			if (fullPrefix) {
				await this.server.register(async (instance) => {
					entry.routable.register(instance)
				}, { prefix: fullPrefix })
			} else {
				entry.routable.register(this.server)
			}
		}

		this.server.setNotFoundHandler((_req, reply) => {
			const err = new RESTError(Status.NOT_FOUND, 'not_found')
			return reply.status(err.status).send(err.toJSON())
		})
	}

	async run(): Promise<void> {
		const host = this.options.host ?? '0.0.0.0'
		await this.server.listen({ host, port: this.options.port })
		this.options.logger?.info?.(`listening on http://${host}:${this.options.port}`)
	}

	async dispose(): Promise<void> {
		await this.server?.close()
	}
}

function combinePrefix(a: string | undefined, b: string | undefined): string {
	const left = normalizePrefix(a)
	const right = normalizePrefix(b)
	if (!left && !right) return ''
	if (!left) return right
	if (!right) return left
	return `${left}${right}`
}
