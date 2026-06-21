import { BaseRepository, CursorOptions, ListOptions, PageOptions, UpsertOptions } from './BaseRepository'
import { CursorPage, Page } from './utils/pagination'
import { Filter } from './utils/filter'
import { TransactionClient } from './utils/transaction'

export interface HookContext<Driver = unknown> {
    trx?: Driver
}

export abstract class EntityService<Entity = any, Driver = unknown> {

    protected constructor(
        protected readonly repository: BaseRepository<Entity, Driver>,
        protected readonly db: TransactionClient<Driver>,
    ) {}

    get primaryKey(): string {
        return this.repository.primaryKey
    }

    transaction<T>(callback: (trx: Driver) => Promise<T>): Promise<T> {
        return this.db.transaction(callback)
    }

    protected withTrx<T>(
        trx: Driver | undefined,
        fn: (trx: Driver) => Promise<T>,
    ): Promise<T> {
        if (trx) return fn(trx)
        return this.db.transaction(fn)
    }

    protected beforeInsert(values: Record<string, any>, _ctx: HookContext<Driver>): Promise<Record<string, any>> | Record<string, any> {
        return values
    }

    protected afterInsert(row: Entity, _ctx: HookContext<Driver>): Promise<Entity> | Entity {
        return row
    }

    protected beforeUpdate(values: Record<string, any>, _ctx: HookContext<Driver> & { id?: any }): Promise<Record<string, any>> | Record<string, any> {
        return values
    }

    protected afterUpdate(row: Entity, _ctx: HookContext<Driver> & { id?: any }): Promise<Entity> | Entity {
        return row
    }

    protected beforeDelete(_ctx: HookContext<Driver> & { id?: any; where?: Filter<Entity> }): Promise<void> | void {}

    protected afterDelete(_count: number, _ctx: HookContext<Driver> & { id?: any; where?: Filter<Entity> }): Promise<void> | void {}

    async insert(values: Record<string, any>, trx?: Driver): Promise<Entity> {
        return this.withTrx(trx, async (t) => {
            const ctx: HookContext<Driver> = { trx: t }
            const prepared = await this.beforeInsert(values, ctx)
            const row = await this.repository.insert(prepared, t)
            return this.afterInsert(row, ctx)
        })
    }

    async upsert(values: Record<string, any>, options: UpsertOptions, trx?: Driver): Promise<Entity> {
        return this.withTrx(trx, async (t) => {
            const ctx: HookContext<Driver> = { trx: t }
            const prepared = await this.beforeInsert(values, ctx)
            const row = await this.repository.upsert(prepared, options, t)
            return this.afterInsert(row, ctx)
        })
    }

    /**
     * Bulk insert. `beforeInsert` and `afterInsert` hooks run unconditionally via
     * `Promise.all`; result order is preserved by index. Override hooks must be
     * safe to invoke in parallel — do not rely on serial side effects.
     */
    async insertMany(values: Record<string, any>[], trx?: Driver): Promise<Entity[]> {
        if (values.length === 0) return []
        return this.withTrx(trx, async (t) => {
            const ctx: HookContext<Driver> = { trx: t }
            const prepared = await Promise.all(values.map((v) => this.beforeInsert(v, ctx)))
            const rows = await this.repository.insertMany(prepared, t)
            return Promise.all(rows.map((row) => this.afterInsert(row, ctx)))
        })
    }

    findById(id: any, trx?: Driver): Promise<Entity | undefined> {
        return this.repository.findById(id, trx)
    }

    findByIdOrThrow(id: any, trx?: Driver): Promise<Entity> {
        return this.repository.findByIdOrThrow(id, trx)
    }

    findByIdMany(ids: readonly any[], trx?: Driver): Promise<Entity[]> {
        return this.repository.findByIdMany(ids, trx)
    }

    findOne(where: Filter<Entity>, trx?: Driver): Promise<Entity | undefined> {
        return this.repository.findOne(where, trx)
    }

    findOneOrThrow(where: Filter<Entity>, trx?: Driver): Promise<Entity> {
        return this.repository.findOneOrThrow(where, trx)
    }

    findMany(opts: ListOptions<Entity> = {}, trx?: Driver): Promise<Entity[]> {
        return this.repository.findMany(opts, trx)
    }

    findManyWithCount(opts: ListOptions<Entity> = {}, trx?: Driver): Promise<{ results: Entity[]; total: number }> {
        return this.repository.findManyWithCount(opts, trx)
    }

    paginate(opts: PageOptions<Entity> = {}, trx?: Driver): Promise<Page<Entity>> {
        return this.repository.paginate(opts, trx)
    }

    paginateCursor(opts: CursorOptions<Entity>, trx?: Driver): Promise<CursorPage<Entity>> {
        return this.repository.paginateCursor(opts, trx)
    }

    exists(where: Filter<Entity>, trx?: Driver): Promise<boolean> {
        return this.repository.exists(where, trx)
    }

    async updateById(id: any, values: Record<string, any>, trx?: Driver): Promise<Entity | undefined> {
        return this.withTrx(trx, async (t) => {
            const ctx = { trx: t, id }
            const prepared = await this.beforeUpdate(values, ctx)
            const row = await this.repository.updateById(id, prepared, t)
            if (!row) return undefined
            return this.afterUpdate(row, ctx)
        })
    }

    async updateByIdOrThrow(id: any, values: Record<string, any>, trx?: Driver): Promise<Entity> {
        return this.withTrx(trx, async (t) => {
            const ctx = { trx: t, id }
            const prepared = await this.beforeUpdate(values, ctx)
            const row = await this.repository.updateByIdOrThrow(id, prepared, t)
            return this.afterUpdate(row, ctx)
        })
    }

    async update(where: Filter<Entity>, values: Record<string, any>, trx?: Driver): Promise<number> {
        return this.withTrx(trx, async (t) => {
            const prepared = await this.beforeUpdate(values, { trx: t })
            return this.repository.update(where, prepared, t)
        })
    }

    async updateOne(where: Filter<Entity>, values: Record<string, any>, trx?: Driver): Promise<Entity | undefined> {
        return this.withTrx(trx, async (t) => {
            const ctx = { trx: t }
            const prepared = await this.beforeUpdate(values, ctx)
            const row = await this.repository.updateOne(where, prepared, t)
            if (!row) return undefined
            return this.afterUpdate(row, ctx)
        })
    }

    async deleteById(id: any, trx?: Driver): Promise<number> {
        return this.withTrx(trx, async (t) => {
            const ctx = { trx: t, id }
            await this.beforeDelete(ctx)
            const count = await this.repository.deleteById(id, t)
            await this.afterDelete(count, ctx)
            return count
        })
    }

    async deleteByIdOrThrow(id: any, trx?: Driver): Promise<void> {
        return this.withTrx(trx, async (t) => {
            const ctx = { trx: t, id }
            await this.beforeDelete(ctx)
            await this.repository.deleteByIdOrThrow(id, t)
            await this.afterDelete(1, ctx)
        })
    }

    /**
     * Bulk-delete by primary key. Issues a single delete over `pk IN (...)`.
     * Hooks fired once: `beforeDelete`/`afterDelete` receive `{ where: { [pk]: ids } }`.
     */
    async deleteMany(ids: readonly any[], trx?: Driver): Promise<number> {
        if (ids.length === 0) return 0
        return this.withTrx(trx, async (t) => {
            const where = { [this.repository.primaryKey]: ids } as unknown as Filter<Entity>
            const ctx = { trx: t, where }
            await this.beforeDelete(ctx)
            const count = await this.repository.deleteMany(ids, t)
            await this.afterDelete(count, ctx)
            return count
        })
    }

    async delete(where: Filter<Entity>, trx?: Driver): Promise<number> {
        return this.withTrx(trx, async (t) => {
            const ctx = { trx: t, where }
            await this.beforeDelete(ctx)
            const count = await this.repository.delete(where, t)
            await this.afterDelete(count, ctx)
            return count
        })
    }

    count(where?: Filter<Entity>, trx?: Driver): Promise<number> {
        return this.repository.count(where, trx)
    }
}
