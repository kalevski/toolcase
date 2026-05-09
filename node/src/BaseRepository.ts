import { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'
import { NotFoundError, OptimisticLockError } from './errors'
import { applyWhere, WhereClause } from './utils/where'
import { applyOrderBy, OrderBy } from './utils/orderBy'
import {
	buildPage,
	CursorPage,
	normalizeOffsetLimit,
	Page,
	PaginationInput,
	PaginationOptions,
} from './utils/pagination'
import type { Executor } from './utils/types'
import { Logger } from './utils/logger'

export type { Trx, Executor } from './utils/types'

export interface ListOptions<T> {
	where?: WhereClause<T>
	orderBy?: OrderBy<T> | OrderBy<T>[]
	limit?: number
	offset?: number
}

export type PageOptions<T> = Omit<ListOptions<T>, 'limit' | 'offset'> & PaginationInput & {
	pagination?: PaginationOptions
}

export interface UpsertOptions<DB, TB extends keyof DB & string> {
	conflictColumns: readonly (keyof DB[TB] & string)[]
	updateColumns?: readonly (keyof DB[TB] & string)[]
}

export interface CursorOptions<T> {
	column: keyof T & string
	direction?: 'asc' | 'desc'
	where?: WhereClause<T>
	limit?: number
	cursor?: string | null
}

export interface QueryEvent {
	table: string
	op: string
	durationMs: number
	error?: unknown
}

export type QueryHook = (event: QueryEvent) => void

export interface BaseRepositoryOptions {
	logger?: Logger
	slowQueryMs?: number
	/** Fires after every query — success or failure. Use for tracing/metrics. */
	onQuery?: QueryHook
}

const DEFAULT_SLOW_QUERY_MS = 250

export abstract class BaseRepository<
	DB,
	TB extends keyof DB & string,
	PK extends keyof DB[TB] & string,
	ID,
> {

	protected readonly logger?: Logger
	protected readonly slowQueryMs: number
	protected readonly tracked: boolean
	protected readonly onQuery?: QueryHook

	protected constructor(
		protected readonly kysely: Kysely<DB>,
		protected readonly table: TB,
		protected readonly pkColumn: PK,
		options: BaseRepositoryOptions = {},
	) {
		this.logger = options.logger
		this.slowQueryMs = options.slowQueryMs ?? DEFAULT_SLOW_QUERY_MS
		this.onQuery = options.onQuery
		this.tracked = !!(this.logger?.warn || this.logger?.debug || this.onQuery)
	}

	get primaryKey(): PK {
		return this.pkColumn
	}

	protected exec(trx?: Transaction<DB>): Executor<DB> {
		return trx ?? this.kysely
	}

	protected byId(id: ID): WhereClause<Selectable<DB[TB]>> {
		return { [this.pkColumn]: id } as WhereClause<Selectable<DB[TB]>>
	}

	private report(label: string, elapsed: number, error?: unknown): void {
		if (elapsed >= this.slowQueryMs) {
			this.logger?.warn?.(`slow query: ${this.table}.${label} took ${elapsed}ms`, {
				table: this.table,
				op: label,
				durationMs: elapsed,
			})
		} else {
			this.logger?.debug?.(`${this.table}.${label} ${elapsed}ms`, {
				table: this.table,
				op: label,
				durationMs: elapsed,
			})
		}
		this.onQuery?.({ table: this.table, op: label, durationMs: elapsed, error })
	}

	protected async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
		if (!this.tracked) return fn()
		const started = Date.now()
		let err: unknown
		try {
			return await fn()
		} catch (error) {
			err = error
			throw error
		} finally {
			this.report(label, Date.now() - started, err)
		}
	}

	async insert(
		values: Insertable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const started = this.tracked ? Date.now() : 0
		try {
			const row = await this.exec(trx)
				.insertInto(this.table)
				.values(values as Insertable<DB[TB]>)
				.returningAll()
				.executeTakeFirstOrThrow()
			return row as Selectable<DB[TB]>
		} finally {
			if (this.tracked) this.report('insert', Date.now() - started)
		}
	}

	async insertMany(
		values: Insertable<DB[TB]>[],
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		if (values.length === 0) return []
		const started = this.tracked ? Date.now() : 0
		try {
			const rows = await this.exec(trx)
				.insertInto(this.table)
				.values(values as Insertable<DB[TB]>[])
				.returningAll()
				.execute()
			return rows as Selectable<DB[TB]>[]
		} finally {
			if (this.tracked) this.report('insertMany', Date.now() - started)
		}
	}

	async upsert(
		values: Insertable<DB[TB]>,
		options: UpsertOptions<DB, TB>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const conflictSet = new Set(options.conflictColumns as readonly string[])
		const updateSource = Object.keys(values as Record<string, unknown>)
			.filter((k) => !conflictSet.has(k)) as unknown as readonly (keyof DB[TB] & string)[]
		const updateCols = options.updateColumns ?? updateSource
		const started = this.tracked ? Date.now() : 0
		try {
			const row = await this.exec(trx)
				.insertInto(this.table)
				.values(values as Insertable<DB[TB]>)
				.onConflict((oc) => {
					const builder = oc.columns(options.conflictColumns as never)
					if (updateCols.length === 0) return builder.doNothing()
					return builder.doUpdateSet(((eb: { ref: (col: string) => unknown }) => {
						const set: Record<string, unknown> = {}
						for (const col of updateCols) {
							set[String(col)] = eb.ref(`excluded.${String(col)}`)
						}
						return set
					}) as never)
				})
				.returningAll()
				.executeTakeFirstOrThrow()
			return row as unknown as Selectable<DB[TB]>
		} finally {
			if (this.tracked) this.report('upsert', Date.now() - started)
		}
	}

	async findById(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = this.exec(trx).selectFrom(this.table).selectAll() as any
			const row = await qb.where(this.pkColumn, '=', id).executeTakeFirst()
			return row as Selectable<DB[TB]> | undefined
		} finally {
			if (this.tracked) this.report('findById', Date.now() - started)
		}
	}

	async findByIdOrThrow(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const row = await this.findById(id, trx)
		if (!row) throw new NotFoundError(this.table, id)
		return row
	}

	async findByIdMany(
		ids: readonly ID[],
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		if (ids.length === 0) return []
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = this.exec(trx).selectFrom(this.table).selectAll() as any
			const rows = await qb.where(this.pkColumn, 'in', ids as readonly ID[]).execute()
			return rows as unknown as Selectable<DB[TB]>[]
		} finally {
			if (this.tracked) this.report('findByIdMany', Date.now() - started)
		}
	}

	async findOne(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = this.exec(trx).selectFrom(this.table).selectAll()
			const [filtered, empty] = applyWhere(qb, where as Record<string, unknown>)
			if (empty) return undefined
			const row = await filtered.executeTakeFirst()
			return row as Selectable<DB[TB]> | undefined
		} finally {
			if (this.tracked) this.report('findOne', Date.now() - started)
		}
	}

	async findOneOrThrow(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const row = await this.findOne(where, trx)
		if (!row) throw new NotFoundError(this.table, JSON.stringify(where))
		return row
	}

	async findMany(
		opts: ListOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		const started = this.tracked ? Date.now() : 0
		try {
			let qb = this.exec(trx).selectFrom(this.table).selectAll()
			if (opts.where) {
				const [filtered, empty] = applyWhere(qb, opts.where as Record<string, unknown>)
				if (empty) return []
				qb = filtered
			}
			if (opts.orderBy) qb = applyOrderBy(qb, opts.orderBy)
			if (opts.limit !== undefined) qb = qb.limit(opts.limit)
			if (opts.offset !== undefined) qb = qb.offset(opts.offset)
			const rows = await qb.execute()
			return rows as unknown as Selectable<DB[TB]>[]
		} finally {
			if (this.tracked) this.report('findMany', Date.now() - started)
		}
	}

	async findManyWithCount(
		opts: ListOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<{ results: Selectable<DB[TB]>[]; total: number }> {
		const started = this.tracked ? Date.now() : 0
		try {
			let qb = this.exec(trx).selectFrom(this.table).selectAll()
			if (opts.where) {
				const [filtered, empty] = applyWhere(qb, opts.where as Record<string, unknown>)
				if (empty) return { results: [], total: 0 }
				qb = filtered
			}
			if (opts.orderBy) qb = applyOrderBy(qb, opts.orderBy)
			if (opts.limit !== undefined) qb = qb.limit(opts.limit)
			if (opts.offset !== undefined) qb = qb.offset(opts.offset)
			const [rows, total] = await Promise.all([
				qb.execute(),
				this.count(opts.where, trx),
			])
			return { results: rows as unknown as Selectable<DB[TB]>[], total }
		} finally {
			if (this.tracked) this.report('findManyWithCount', Date.now() - started)
		}
	}

	async paginate(
		opts: PageOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<Page<Selectable<DB[TB]>>> {
		const { offset, limit } = normalizeOffsetLimit(opts as PaginationInput, opts.pagination)
		const started = this.tracked ? Date.now() : 0
		try {
			let qb = this.exec(trx).selectFrom(this.table).selectAll()
			if (opts.where) {
				const [filtered, empty] = applyWhere(qb, opts.where as Record<string, unknown>)
				if (empty) return buildPage([], 0, offset, limit)
				qb = filtered
			}
			if (opts.orderBy) qb = applyOrderBy(qb, opts.orderBy)
			qb = qb.limit(limit).offset(offset)
			const [rows, total] = await Promise.all([
				qb.execute(),
				this.count(opts.where, trx),
			])
			return buildPage(rows as unknown as Selectable<DB[TB]>[], total, offset, limit)
		} finally {
			if (this.tracked) this.report('paginate', Date.now() - started)
		}
	}

	async paginateCursor(
		opts: CursorOptions<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<CursorPage<Selectable<DB[TB]>>> {
		const started = this.tracked ? Date.now() : 0
		try {
			const limit = opts.limit ?? 25
			const direction = opts.direction ?? 'asc'
			const op = direction === 'asc' ? '>' : '<'
			let qb = this.exec(trx).selectFrom(this.table).selectAll()
			if (opts.where) {
				const [filtered, empty] = applyWhere(qb, opts.where as Record<string, unknown>)
				if (empty) return { results: [], nextCursor: null, hasMore: false }
				qb = filtered
			}
			if (opts.cursor) {
				const decoded = decodeCursor(opts.cursor)
				const cursorable = qb as unknown as {
					where: (column: string, op: string, value: unknown) => typeof qb
				}
				qb = cursorable.where(opts.column, op, decoded)
			}
			const ordered = qb as unknown as {
				orderBy: (column: string, direction: string) => typeof qb
			}
			qb = ordered.orderBy(opts.column, direction)
			qb = qb.limit(limit + 1)
			const rows = (await qb.execute()) as unknown as Record<string, unknown>[]
			const hasMore = rows.length > limit
			const trimmed = hasMore ? rows.slice(0, limit) : rows
			const last = trimmed[trimmed.length - 1]
			const nextCursor = hasMore && last ? encodeCursor(last[opts.column]) : null
			return {
				results: trimmed as unknown as Selectable<DB[TB]>[],
				nextCursor,
				hasMore,
			}
		} finally {
			if (this.tracked) this.report('paginateCursor', Date.now() - started)
		}
	}

	async exists(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<boolean> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = (this.exec(trx).selectFrom(this.table) as any)
				.select((eb: any) => eb.lit(1).as('one'))
			const [filtered, empty] = applyWhere(qb, where as Record<string, unknown>)
			if (empty) return false
			const row = await (filtered as any).limit(1).executeTakeFirst()
			return row !== undefined
		} finally {
			if (this.tracked) this.report('exists', Date.now() - started)
		}
	}

	async updateById(
		id: ID,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = this.exec(trx).updateTable(this.table) as any
			const row = await qb
				.set(values)
				.where(this.pkColumn, '=', id)
				.returningAll()
				.executeTakeFirst()
			return row as unknown as Selectable<DB[TB]> | undefined
		} finally {
			if (this.tracked) this.report('updateById', Date.now() - started)
		}
	}

	async updateByIdOrThrow(
		id: ID,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const row = await this.updateById(id, values, trx)
		if (!row) throw new NotFoundError(this.table, id)
		return row
	}

	async updateByIdAndVersion(
		id: ID,
		expectedVersion: number,
		values: Updateable<DB[TB]>,
		options: { versionColumn?: keyof DB[TB] & string } = {},
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const versionColumn = options.versionColumn ?? ('version' as keyof DB[TB] & string)
		const merged = {
			...(values as Record<string, unknown>),
			[versionColumn]: expectedVersion + 1,
		}
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = (this.exec(trx).updateTable(this.table) as any)
				.set(merged)
				.returningAll()
			const where = {
				[this.pkColumn]: id,
				[versionColumn]: expectedVersion,
			}
			const [filtered] = applyWhere(qb, where as Record<string, unknown>)
			const row = await (filtered as any).executeTakeFirst()
			if (!row) {
				throw new OptimisticLockError(this.table, expectedVersion, null)
			}
			return row as unknown as Selectable<DB[TB]>
		} finally {
			if (this.tracked) this.report('updateByIdAndVersion', Date.now() - started)
		}
	}

	async updateOne(
		where: WhereClause<Selectable<DB[TB]>>,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = (this.exec(trx).updateTable(this.table) as any)
				.set(values)
				.returningAll()
			const [filtered, empty] = applyWhere(qb, where as Record<string, unknown>)
			if (empty) return undefined
			const row = await (filtered as any).executeTakeFirst()
			return row as unknown as Selectable<DB[TB]> | undefined
		} finally {
			if (this.tracked) this.report('updateOne', Date.now() - started)
		}
	}

	async update(
		where: WhereClause<Selectable<DB[TB]>>,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = (this.exec(trx).updateTable(this.table) as any).set(values)
			const [filtered, empty] = applyWhere(qb, where as Record<string, unknown>)
			if (empty) return 0
			const result = await (filtered as any).execute()
			const total = (result as any[]).reduce(
				(acc: bigint, r: any) => acc + ((r as { numUpdatedRows?: bigint }).numUpdatedRows ?? 0n),
				0n,
			)
			return Number(total)
		} finally {
			if (this.tracked) this.report('update', Date.now() - started)
		}
	}

	async updateMany(
		ids: readonly ID[],
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<number> {
		if (ids.length === 0) return 0
		return this.update(
			{ [this.pkColumn]: ids } as WhereClause<Selectable<DB[TB]>>,
			values,
			trx,
		)
	}

	async deleteById(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<number> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = this.exec(trx).deleteFrom(this.table) as any
			const result = await qb.where(this.pkColumn, '=', id).execute()
			const total = (result as any[]).reduce(
				(acc: bigint, r: any) => acc + ((r as { numDeletedRows?: bigint }).numDeletedRows ?? 0n),
				0n,
			)
			return Number(total)
		} finally {
			if (this.tracked) this.report('deleteById', Date.now() - started)
		}
	}

	async deleteByIdOrThrow(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<void> {
		const count = await this.deleteById(id, trx)
		if (count === 0) throw new NotFoundError(this.table, id)
	}

	async deleteMany(
		ids: readonly ID[],
		trx?: Transaction<DB>,
	): Promise<number> {
		if (ids.length === 0) return 0
		return this.delete(
			{ [this.pkColumn]: ids } as WhereClause<Selectable<DB[TB]>>,
			trx,
		)
	}

	async delete(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = this.exec(trx).deleteFrom(this.table)
			const [filtered, empty] = applyWhere(qb, where as Record<string, unknown>)
			if (empty) return 0
			const result = await filtered.execute()
			const total = result.reduce(
				(acc, r) => acc + ((r as { numDeletedRows?: bigint }).numDeletedRows ?? 0n),
				0n,
			)
			return Number(total)
		} finally {
			if (this.tracked) this.report('delete', Date.now() - started)
		}
	}

	async count(
		where?: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const started = this.tracked ? Date.now() : 0
		try {
			const qb = (this.exec(trx).selectFrom(this.table) as any)
				.select((eb: any) => eb.fn.countAll().as('count'))
			let filtered = qb
			if (where) {
				const [applied, empty] = applyWhere(qb, where as Record<string, unknown>)
				if (empty) return 0
				filtered = applied
			}
			const row = await (filtered as any).executeTakeFirstOrThrow() as { count: string | number | bigint }
			return Number(row.count)
		} finally {
			if (this.tracked) this.report('count', Date.now() - started)
		}
	}
}

function encodeCursor(value: unknown): string {
	let kind: 's' | 'n' | 'b' | 'd' | 'g'
	let v: string
	if (value instanceof Date) {
		kind = 'd'
		v = value.toISOString()
	} else if (typeof value === 'bigint') {
		kind = 'g'
		v = value.toString()
	} else if (typeof value === 'number') {
		kind = 'n'
		v = String(value)
	} else if (typeof value === 'boolean') {
		kind = 'b'
		v = value ? '1' : '0'
	} else {
		kind = 's'
		v = String(value)
	}
	return Buffer.from(`${kind}:${v}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): unknown {
	const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
	const idx = decoded.indexOf(':')
	if (idx < 0) return decoded
	const kind = decoded.slice(0, idx)
	const v = decoded.slice(idx + 1)
	switch (kind) {
		case 'd': return new Date(v)
		case 'g': return BigInt(v)
		case 'n': return Number(v)
		case 'b': return v === '1'
		case 's': return v
		default: return v
	}
}
