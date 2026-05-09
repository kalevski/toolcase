import { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'
import { BaseRepository, ListOptions, PageOptions, UpsertOptions } from './BaseRepository'
import { CursorPage, Page } from './utils/pagination'
import { CursorOptions } from './BaseRepository'
import { WhereClause } from './utils/where'
import { Trx } from './utils/types'

export interface HookContext<DB> {
	trx?: Transaction<DB>
}

export abstract class EntityService<
	DB,
	TB extends keyof DB & string,
	PK extends keyof DB[TB] & string,
	ID,
> {

	protected constructor(
		protected readonly repository: BaseRepository<DB, TB, PK, ID>,
		protected readonly kysely: Kysely<DB>,
	) {}

	get primaryKey(): PK {
		return this.repository.primaryKey
	}

	transaction<T>(callback: (trx: Trx<DB>) => Promise<T>): Promise<T> {
		return this.kysely.transaction().execute(callback)
	}

	protected withTrx<T>(
		trx: Transaction<DB> | undefined,
		fn: (trx: Transaction<DB>) => Promise<T>,
	): Promise<T> {
		if (trx) return fn(trx)
		return this.kysely.transaction().execute(fn)
	}

	protected beforeInsert(values: Insertable<DB[TB]>, _ctx: HookContext<DB>): Promise<Insertable<DB[TB]>> | Insertable<DB[TB]> {
		return values
	}

	protected afterInsert(row: Selectable<DB[TB]>, _ctx: HookContext<DB>): Promise<Selectable<DB[TB]>> | Selectable<DB[TB]> {
		return row
	}

	protected beforeUpdate(values: Updateable<DB[TB]>, _ctx: HookContext<DB> & { id?: ID }): Promise<Updateable<DB[TB]>> | Updateable<DB[TB]> {
		return values
	}

	protected afterUpdate(row: Selectable<DB[TB]>, _ctx: HookContext<DB> & { id?: ID }): Promise<Selectable<DB[TB]>> | Selectable<DB[TB]> {
		return row
	}

	protected beforeDelete(_ctx: HookContext<DB> & { id?: ID; where?: WhereClause<Selectable<DB[TB]>> }): Promise<void> | void {}

	protected afterDelete(_count: number, _ctx: HookContext<DB> & { id?: ID; where?: WhereClause<Selectable<DB[TB]>> }): Promise<void> | void {}

	async insert(
		values: Insertable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const ctx: HookContext<DB> = { trx }
		const prepared = await this.beforeInsert(values, ctx)
		const row = await this.repository.insert(prepared, trx)
		return this.afterInsert(row, ctx)
	}

	async upsert(
		values: Insertable<DB[TB]>,
		options: UpsertOptions<DB, TB>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const ctx: HookContext<DB> = { trx }
		const prepared = await this.beforeInsert(values, ctx)
		const row = await this.repository.upsert(prepared, options, trx)
		return this.afterInsert(row, ctx)
	}

	/**
	 * Bulk insert. `beforeInsert` and `afterInsert` hooks run concurrently via
	 * `Promise.all`; result order is preserved by index. Override hooks must be
	 * safe to invoke in parallel — do not rely on serial side effects.
	 */
	async insertMany(
		values: Insertable<DB[TB]>[],
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		if (values.length === 0) return []
		const ctx: HookContext<DB> = { trx }
		const hasBefore = this.beforeInsert !== EntityService.prototype.beforeInsert
		const hasAfter = this.afterInsert !== EntityService.prototype.afterInsert
		const prepared = hasBefore
			? await Promise.all(values.map((v) => this.beforeInsert(v, ctx)))
			: values
		const rows = await this.repository.insertMany(prepared, trx)
		if (!hasAfter) return rows
		return Promise.all(rows.map((row) => this.afterInsert(row, ctx)))
	}

	findById(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		return this.repository.findById(id, trx)
	}

	findByIdOrThrow(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		return this.repository.findByIdOrThrow(id, trx)
	}

	findByIdMany(
		ids: readonly ID[],
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		return this.repository.findByIdMany(ids, trx)
	}

	findOne(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		return this.repository.findOne(where, trx)
	}

	findOneOrThrow(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		return this.repository.findOneOrThrow(where, trx)
	}

	findMany(
		opts: ListOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>[]> {
		return this.repository.findMany(opts, trx)
	}

	findManyWithCount(
		opts: ListOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<{ results: Selectable<DB[TB]>[]; total: number }> {
		return this.repository.findManyWithCount(opts, trx)
	}

	paginate(
		opts: PageOptions<Selectable<DB[TB]>> = {},
		trx?: Transaction<DB>,
	): Promise<Page<Selectable<DB[TB]>>> {
		return this.repository.paginate(opts, trx)
	}

	paginateCursor(
		opts: CursorOptions<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<CursorPage<Selectable<DB[TB]>>> {
		return this.repository.paginateCursor(opts, trx)
	}

	exists(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<boolean> {
		return this.repository.exists(where, trx)
	}

	async updateById(
		id: ID,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		const ctx = { trx, id }
		const prepared = await this.beforeUpdate(values, ctx)
		const row = await this.repository.updateById(id, prepared, trx)
		if (!row) return undefined
		return this.afterUpdate(row, ctx)
	}

	async updateByIdOrThrow(
		id: ID,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]>> {
		const ctx = { trx, id }
		const prepared = await this.beforeUpdate(values, ctx)
		const row = await this.repository.updateByIdOrThrow(id, prepared, trx)
		return this.afterUpdate(row, ctx)
	}

	async update(
		where: WhereClause<Selectable<DB[TB]>>,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const prepared = await this.beforeUpdate(values, { trx })
		return this.repository.update(where, prepared, trx)
	}

	async updateOne(
		where: WhereClause<Selectable<DB[TB]>>,
		values: Updateable<DB[TB]>,
		trx?: Transaction<DB>,
	): Promise<Selectable<DB[TB]> | undefined> {
		const ctx = { trx }
		const prepared = await this.beforeUpdate(values, ctx)
		const row = await this.repository.updateOne(where, prepared, trx)
		if (!row) return undefined
		return this.afterUpdate(row, ctx)
	}

	async deleteById(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<number> {
		const ctx = { trx, id }
		await this.beforeDelete(ctx)
		const count = await this.repository.deleteById(id, trx)
		await this.afterDelete(count, ctx)
		return count
	}

	async deleteByIdOrThrow(
		id: ID,
		trx?: Transaction<DB>,
	): Promise<void> {
		const ctx = { trx, id }
		await this.beforeDelete(ctx)
		await this.repository.deleteByIdOrThrow(id, trx)
		await this.afterDelete(1, ctx)
	}

	/**
	 * Bulk-delete by primary key. Issues a single SQL `DELETE ... WHERE pk IN (...)`.
	 * Hooks fired once: `beforeDelete`/`afterDelete` receive `{ where: { [pk]: ids } }`.
	 */
	async deleteMany(
		ids: readonly ID[],
		trx?: Transaction<DB>,
	): Promise<number> {
		if (ids.length === 0) return 0
		const where = { [this.repository.primaryKey]: ids } as unknown as WhereClause<Selectable<DB[TB]>>
		const ctx = { trx, where }
		await this.beforeDelete(ctx)
		const count = await this.repository.deleteMany(ids, trx)
		await this.afterDelete(count, ctx)
		return count
	}

	async delete(
		where: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		const ctx = { trx, where }
		await this.beforeDelete(ctx)
		const count = await this.repository.delete(where, trx)
		await this.afterDelete(count, ctx)
		return count
	}

	count(
		where?: WhereClause<Selectable<DB[TB]>>,
		trx?: Transaction<DB>,
	): Promise<number> {
		return this.repository.count(where, trx)
	}
}
