import { Kysely, Selectable, Transaction, Updateable } from 'kysely'
import { BaseRepository, BaseRepositoryOptions, ListOptions, PageOptions } from './BaseRepository'
import { Page } from './utils/pagination'
import { WhereClause } from './utils/where'
import { NotFoundError } from './errors'

export interface SoftDeleteOptions extends BaseRepositoryOptions {
	deletedAtColumn?: string
}

const SOFT_DELETE_COLUMN = 'deleted_at'

const IS_NULL = Object.freeze({ isNull: true as const })

export abstract class SoftDeleteRepository<
	DB,
	TB extends keyof DB & string,
	PK extends keyof DB[TB] & string,
	ID,
> extends BaseRepository<DB, TB, PK, ID> {

	protected readonly deletedAtColumn: string

	protected constructor(
		kysely: Kysely<DB>,
		table: TB,
		pkColumn: PK,
		options: SoftDeleteOptions = {},
	) {
		super(kysely, table, pkColumn, options)
		this.deletedAtColumn = options.deletedAtColumn ?? SOFT_DELETE_COLUMN
	}

	private mergeActiveWhere(
		where?: WhereClause<Selectable<DB[TB]>>,
	): WhereClause<Selectable<DB[TB]>> {
		if (!where) {
			return { [this.deletedAtColumn]: IS_NULL } as WhereClause<Selectable<DB[TB]>>
		}
		return {
			...(where as Record<string, unknown>),
			[this.deletedAtColumn]: IS_NULL,
		} as WhereClause<Selectable<DB[TB]>>
	}

	findActiveById(id: ID, trx?: Transaction<DB>): Promise<Selectable<DB[TB]> | undefined> {
		return this.findOne(
			this.mergeActiveWhere(this.byId(id)),
			trx,
		)
	}

	async findActiveByIdOrThrow(id: ID, trx?: Transaction<DB>): Promise<Selectable<DB[TB]>> {
		const row = await this.findActiveById(id, trx)
		if (!row) throw new NotFoundError(this.table, id)
		return row
	}

	findManyActive(
		opts: ListOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		return this.findMany({ ...opts, where: this.mergeActiveWhere(opts.where) }, trx)
	}

	paginateActive(
		opts: PageOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<Page<Selectable<DB[TB]>>> {
		return this.paginate({ ...opts, where: this.mergeActiveWhere(opts.where) }, trx)
	}

	countActive(
		where?: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		return this.count(this.mergeActiveWhere(where), trx)
	}

	existsActive(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<boolean> {
		return this.exists(this.mergeActiveWhere(where), trx)
	}

	async softDeleteById(id: ID, trx?: Transaction<DB>): Promise<number> {
		const values: Record<string, unknown> = { [this.deletedAtColumn]: new Date() }
		return this.update(
			this.mergeActiveWhere(this.byId(id)),
			values as Updateable<DB[TB]>,
			trx,
		)
	}

	async softDeleteByIdOrThrow(id: ID, trx?: Transaction<DB>): Promise<void> {
		const count = await this.softDeleteById(id, trx)
		if (count === 0) throw new NotFoundError(this.table, id)
	}

	async softDelete(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const values: Record<string, unknown> = { [this.deletedAtColumn]: new Date() }
		return this.update(
			this.mergeActiveWhere(where),
			values as Updateable<DB[TB]>,
			trx,
		)
	}

	async restoreById(id: ID, trx?: Transaction<DB>): Promise<number> {
		const values: Record<string, unknown> = { [this.deletedAtColumn]: null }
		return this.update(this.byId(id), values as Updateable<DB[TB]>, trx)
	}

	async restore(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const values: Record<string, unknown> = { [this.deletedAtColumn]: null }
		return this.update(where, values as Updateable<DB[TB]>, trx)
	}
}
