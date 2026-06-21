import { HTTP } from '@toolcase/base'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify'
import { errorMeta, ValidationError } from './errors'
import { PaginationOptions } from './utils/pagination'
import { normalizePrefix } from './utils/path'
import {
	Sanitizer,
	createSanitizer,
	FieldSchema,
} from './utils/sanitize'

const { RESTError, RESTResponse, Status } = HTTP

const DEFAULT_ID_PARAM = 'id'

export type RouteIdType = 'string' | 'integer' | 'bigint'

const ID_TYPE_PARSERS: Record<RouteIdType, (raw: string) => unknown> = {
	string: (raw) => raw,
	integer: (raw) => {
		const n = Number(raw)
		if (!Number.isInteger(n)) throw new ValidationError(`not an integer: ${raw}`)
		return n
	},
	bigint: (raw) => {
		try {
			return BigInt(raw)
		} catch {
			throw new ValidationError(`not a bigint: ${raw}`)
		}
	},
}

export type PreHandler = (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void

export type RestrictedFieldsResolver = readonly string[] | ((req: FastifyRequest) => readonly string[])

export interface RouteHandlerOptions<T extends object = Record<string, unknown>> {
	prefix?: string
	schema?: FieldSchema<T>
	resourceName?: string
	idParam?: string
	idType?: RouteIdType
	parseId?: (raw: string) => unknown
	preHandlers?: PreHandler[]
	strictInput?: boolean
	strictQuery?: boolean
	allowedQueryKeys?: readonly string[]
	restrictedInputFields?: RestrictedFieldsResolver
	restrictedOutputFields?: RestrictedFieldsResolver
	pagination?: PaginationOptions
}

const EMPTY_SCHEMA: FieldSchema<Record<string, unknown>> = {}

/**
 * Abstract HTTP endpoint base. Provides protected helpers (path resolution,
 * sanitization, id parsing, response wrapping, error mapping) but does NOT
 * register any routes itself. Subclasses implement `register(fastify)` and
 * call helpers as needed.
 *
 * Compose multiple route handlers with `Router`.
 */
export abstract class RouteHandler<T extends object = Record<string, unknown>> {

	protected readonly sanitizer: Sanitizer<T>
	protected readonly idParam: string
	protected readonly prefix: string
	protected readonly idType: RouteIdType
	protected readonly idParser: (raw: string) => unknown

	constructor(protected readonly options: RouteHandlerOptions<T> = {}) {
		const schema = (options.schema ?? EMPTY_SCHEMA) as FieldSchema<T>
		this.sanitizer = createSanitizer<T>(schema)
		this.idParam = options.idParam ?? DEFAULT_ID_PARAM
		this.prefix = normalizePrefix(options.prefix)
		this.idType = options.idType ?? 'string'
		this.idParser = options.parseId ?? ID_TYPE_PARSERS[this.idType]
	}

	/**
	 * Subclass attaches routes onto the fastify instance. Use `path()`,
	 * `itemPath()`, and `routeOptions()` helpers to build paths and option
	 * objects consistent with the configured prefix and pre-handlers.
	 */
	abstract register(fastify: FastifyInstance): void

	// -------------------------------------------------------------------------
	// Path / route helpers
	// -------------------------------------------------------------------------

	protected path(suffix: string = ''): string {
		if (suffix === '' || suffix === '/') return this.prefix === '' ? '/' : this.prefix
		return `${this.prefix}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
	}

	protected itemPath(): string {
		return this.path(`/:${this.idParam}`)
	}

	protected routeOptions(
		specific: PreHandler[] = [],
		schema?: RouteShorthandOptions['schema'],
	): RouteShorthandOptions {
		const all = this.options.preHandlers ?? []
		const handlers = specific.length > 0
			? (all.length > 0 ? [...all, ...specific] : specific)
			: all
		const out: RouteShorthandOptions = {}
		if (handlers.length > 0) out.preHandler = handlers as never
		if (schema) out.schema = schema
		return out
	}

	// -------------------------------------------------------------------------
	// Sanitization
	// -------------------------------------------------------------------------

	protected sanitizeInput(data: unknown, req: FastifyRequest): unknown {
		return this.sanitizer.input(data, {
			strict: this.options.strictInput,
			restrictedFields: this.resolveRestricted(this.options.restrictedInputFields, req),
		})
	}

	protected sanitizeOutput(data: unknown, req: FastifyRequest): unknown {
		return this.sanitizer.output(data, {
			restrictedFields: this.resolveRestricted(this.options.restrictedOutputFields, req),
		})
	}

	protected sanitizeQuery(query: Record<string, unknown>, _req: FastifyRequest): unknown {
		return this.sanitizer.query(query, {
			strict: this.options.strictQuery,
			allowedKeys: this.options.allowedQueryKeys,
		})
	}

	// -------------------------------------------------------------------------
	// ID parsing
	// -------------------------------------------------------------------------

	protected parseId<ID = unknown>(req: FastifyRequest): ID {
		const params = (req.params ?? {}) as Record<string, string>
		const raw = params[this.idParam]
		if (raw === undefined) {
			throw new ValidationError(`Missing path parameter: ${this.idParam}`)
		}
		try {
			return this.idParser(raw) as ID
		} catch (error) {
			if (error instanceof ValidationError) throw error
			throw new ValidationError(`Invalid ${this.idParam}: ${raw}`)
		}
	}

	// -------------------------------------------------------------------------
	// Response builders
	// -------------------------------------------------------------------------

	protected ok<D>(data: D, count?: number): unknown {
		return new RESTResponse(Status.OK, data, count)
	}

	protected created<D>(reply: FastifyReply, data: D, status: number = Status.CREATED): unknown {
		reply.code(status)
		return new RESTResponse(status, data)
	}

	protected accepted<D>(reply: FastifyReply, data: D): unknown {
		reply.code(Status.ACCEPTED)
		return new RESTResponse(Status.ACCEPTED, data)
	}

	protected noContent(reply: FastifyReply, status: number = Status.NO_CONTENT): null {
		reply.code(status)
		return null
	}

	// -------------------------------------------------------------------------
	// Error mapping
	// -------------------------------------------------------------------------

	/**
	 * Maps an error to an HTTP response envelope. EndpointError subclasses
	 * surface as `{ status: 'rejected', cause: error.code, details? }` at the
	 * resolved status code. Anything else returns 500 + `internal_error` and
	 * forwards the error to `onError` for logging.
	 *
	 * Public so callers can wrap/compose (e.g. Sentry, OTel) without subclassing.
	 */
	mapError(error: unknown, reply: FastifyReply): unknown {
		const meta = errorMeta(error)
		const status = meta?.status ?? Status.INTERNAL_SERVER_ERROR
		reply.code(status)
		if (meta && meta.code !== null) {
			const body = new RESTError(status, meta.code).toJSON() as {
				status: string
				cause: string
				details?: unknown
			}
			if (error instanceof ValidationError && error.details !== undefined) {
				body.details = error.details
			}
			return body
		}
		this.onError(error)
		return new RESTError(status, 'internal_error').toJSON()
	}

	/**
	 * Hook for unhandled (non-EndpointError) errors. Override to log.
	 */
	protected onError(_error: unknown): void {}

	// -------------------------------------------------------------------------
	// Misc
	// -------------------------------------------------------------------------

	protected resourceName(): string {
		if (this.options.resourceName) return this.options.resourceName
		const ctor = this.constructor as { resourceName?: string }
		return ctor.resourceName ?? 'Resource'
	}

	protected resolveRestricted(
		resolver: RestrictedFieldsResolver | undefined,
		req: FastifyRequest,
	): readonly string[] | undefined {
		if (!resolver) return undefined
		if (typeof resolver === 'function') return resolver(req)
		return resolver
	}
}

/**
 * Composes multiple route handlers behind a single `register(fastify)` call so
 * a caller can attach a whole feature surface in one line.
 */
export class Router {

	private readonly handlers: RouteHandler[] = []

	add(handler: RouteHandler): this {
		this.handlers.push(handler)
		return this
	}

	addAll(handlers: readonly RouteHandler[]): this {
		for (const handler of handlers) this.handlers.push(handler)
		return this
	}

	register(fastify: FastifyInstance): void {
		for (const handler of this.handlers) handler.register(fastify)
	}
}

