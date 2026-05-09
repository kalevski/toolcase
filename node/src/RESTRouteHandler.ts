import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify'
import { Insertable, Selectable, Updateable } from 'kysely'
import { EntityService } from './EntityService'
import { RouteHandler, RouteHandlerOptions, PreHandler } from './RouteHandler'
import { NotFoundError, ValidationError } from './errors'
import { OrderBy } from './utils/orderBy'
import { parseFilters } from './utils/parseFilters'
import { parseSort } from './utils/parseSort'
import { normalizeOffsetLimit } from './utils/pagination'
import { FieldRule } from './utils/sanitize'
import { WhereClause } from './utils/where'

export type RESTMethod = 'list' | 'get' | 'create' | 'update' | 'delete'

const ALL_METHODS: ReadonlyArray<RESTMethod> = ['list', 'get', 'create', 'update', 'delete']

export interface RESTRouteHandlerOptions<T extends object> extends RouteHandlerOptions<T> {
	canList?: PreHandler | PreHandler[]
	canGet?: PreHandler | PreHandler[]
	canCreate?: PreHandler | PreHandler[]
	canUpdate?: PreHandler | PreHandler[]
	canDelete?: PreHandler | PreHandler[]

	/**
	 * Group alias. Fallback for `canList` + `canGet` when no per-verb hook set.
	 */
	canRead?: PreHandler | PreHandler[]
	/**
	 * Group alias. Fallback for `canCreate` + `canUpdate` + `canDelete` when no
	 * per-verb hook set.
	 */
	canWrite?: PreHandler | PreHandler[]

	methods?: ReadonlyArray<RESTMethod>
	filterableFields?: ReadonlyArray<keyof T & string>
	sortableFields?: ReadonlyArray<keyof T & string>
	defaultOrderBy?: OrderBy<T> | OrderBy<T>[]

	/**
	 * Permit an empty PATCH body (`{}` after sanitize) — issues a no-op UPDATE
	 * instead of rejecting with 400. Default: false (reject).
	 */
	allowEmptyPatch?: boolean
}

export class RESTRouteHandler<
	DB,
	TB extends keyof DB & string,
	PK extends keyof DB[TB] & string,
	ID,
	T extends object = Selectable<DB[TB]> & object,
> extends RouteHandler<T> {

	protected readonly service: EntityService<DB, TB, PK, ID>
	private readonly methods: ReadonlySet<RESTMethod>
	private readonly filterableFields: ReadonlyArray<keyof T & string> | undefined
	private readonly sortableFields: ReadonlyArray<keyof T & string> | undefined

	constructor(
		service: EntityService<DB, TB, PK, ID>,
		options: RESTRouteHandlerOptions<T> = {},
	) {
		super(options)
		this.service = service
		this.methods = new Set<RESTMethod>(options.methods ?? ALL_METHODS)
		this.filterableFields = resolveFieldList(options.filterableFields, options.schema)
		this.sortableFields = resolveFieldList(options.sortableFields, options.schema)
	}

	register(fastify: FastifyInstance): void {
		const opts = this.options as RESTRouteHandlerOptions<T>
		const wrap = (fn: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
			async (req: FastifyRequest, reply: FastifyReply) => {
				try { return await fn.call(this, req, reply) }
				catch (e) { return this.mapError(e, reply) }
			}

		if (this.methods.has('list')) {
			fastify.get(this.path(), this.routeOptionsFor('list', opts), wrap(this.handleList))
		}
		if (this.methods.has('get')) {
			fastify.get(this.itemPath(), this.routeOptionsFor('get', opts), wrap(this.handleGet))
		}
		if (this.methods.has('create')) {
			fastify.post(this.path(), this.routeOptionsFor('create', opts), wrap(this.handleCreate))
		}
		if (this.methods.has('update')) {
			fastify.patch(this.itemPath(), this.routeOptionsFor('update', opts), wrap(this.handleUpdate))
		}
		if (this.methods.has('delete')) {
			fastify.delete(this.itemPath(), this.routeOptionsFor('delete', opts), wrap(this.handleDelete))
		}
	}

	private routeOptionsFor(method: RESTMethod, opts: RESTRouteHandlerOptions<T>): RouteShorthandOptions {
		return this.routeOptions(resolveVerbHandlers(method, opts))
	}

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	private handleList = async (req: FastifyRequest): Promise<unknown> => {
		const opts = this.options as RESTRouteHandlerOptions<T>
		const raw = (req.query ?? {}) as Record<string, unknown>
		const { offset, limit } = normalizeOffsetLimit(raw, opts.pagination)
		const sort = parseSort<T>(raw, { allowedFields: this.sortableFields })
		const orderBy = sort ?? opts.defaultOrderBy
		const where = parseFilters<T>(raw, {
			allowedFields: this.filterableFields,
			schema: opts.schema,
		})
		const page = await this.service.paginate({
			where: where as WhereClause<Selectable<DB[TB]>>,
			orderBy: orderBy as OrderBy<Selectable<DB[TB]>> | OrderBy<Selectable<DB[TB]>>[] | undefined,
			offset,
			limit,
			pagination: opts.pagination,
		})
		const results = (page.results as unknown[]).map((row) => this.sanitizeOutput(row, req))
		return this.ok(results, page.pagination.count)
	}

	private handleGet = async (req: FastifyRequest): Promise<unknown> => {
		const id = this.parseId<ID>(req)
		const row = await this.service.findById(id)
		if (!row) throw new NotFoundError(this.resourceName(), id)
		return this.ok(this.sanitizeOutput(row, req))
	}

	private handleCreate = async (req: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
		if (req.body === null || typeof req.body !== 'object') {
			throw new ValidationError('Missing or invalid body')
		}
		const body = this.sanitizeInput(req.body, req)
		const row = await this.service.insert(body as Insertable<DB[TB]>)
		return this.created(reply, this.sanitizeOutput(row, req))
	}

	private handleUpdate = async (req: FastifyRequest): Promise<unknown> => {
		const opts = this.options as RESTRouteHandlerOptions<T>
		const id = this.parseId<ID>(req)
		if (req.body === null || typeof req.body !== 'object') {
			throw new ValidationError('Missing or invalid body')
		}
		const body = this.sanitizeInput(req.body, req) as Record<string, unknown>
		if (!opts.allowEmptyPatch && Object.keys(body).length === 0) {
			throw new ValidationError('Empty patch')
		}
		const row = await this.service.updateByIdOrThrow(id, body as Updateable<DB[TB]>)
		return this.ok(this.sanitizeOutput(row, req))
	}

	private handleDelete = async (req: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
		const id = this.parseId<ID>(req)
		await this.service.deleteByIdOrThrow(id)
		return this.noContent(reply)
	}
}

function toArray<X>(value: X | X[] | undefined): X[] {
	if (value === undefined) return []
	return Array.isArray(value) ? value : [value]
}

function resolveVerbHandlers<T extends object>(
	method: RESTMethod,
	opts: RESTRouteHandlerOptions<T>,
): PreHandler[] {
	const perVerb = perVerbFor(method, opts)
	if (perVerb !== undefined) return toArray(perVerb)
	const group = groupFor(method, opts)
	if (group !== undefined) return toArray(group)
	return []
}

function perVerbFor<T extends object>(
	method: RESTMethod,
	opts: RESTRouteHandlerOptions<T>,
): PreHandler | PreHandler[] | undefined {
	switch (method) {
		case 'list': return opts.canList
		case 'get': return opts.canGet
		case 'create': return opts.canCreate
		case 'update': return opts.canUpdate
		case 'delete': return opts.canDelete
	}
}

function groupFor<T extends object>(
	method: RESTMethod,
	opts: RESTRouteHandlerOptions<T>,
): PreHandler | PreHandler[] | undefined {
	if (method === 'list' || method === 'get') return opts.canRead
	return opts.canWrite
}

function resolveFieldList<T extends object>(
	explicit: ReadonlyArray<keyof T & string> | undefined,
	schema: { [K in keyof T]?: FieldRule } | undefined,
): ReadonlyArray<keyof T & string> | undefined {
	if (explicit !== undefined) return explicit
	if (!schema) return [] as ReadonlyArray<keyof T & string>
	const out: (keyof T & string)[] = []
	for (const key of Object.keys(schema) as (keyof T & string)[]) {
		const rule = schema[key]
		if (rule?.private || rule?.writeOnly) continue
		out.push(key)
	}
	return out
}
