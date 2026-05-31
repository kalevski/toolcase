import { NotFoundError } from './errors'
import { Filter } from './utils/filter'
import { Sort } from './utils/sort'
import { CursorPage, Page, PaginationInput, PaginationOptions } from './utils/pagination'
import { Logger } from './utils/logger'

export interface ListOptions<T = any> {
    where?: Filter<T>
    orderBy?: Sort<T> | Sort<T>[]
    limit?: number
    offset?: number
}

export type PageOptions<T = any> = Omit<ListOptions<T>, 'limit' | 'offset'> & PaginationInput & {
    pagination?: PaginationOptions
}

export interface UpsertOptions {
    uniqueBy: readonly string[]
    update?: readonly string[]
}

export interface CursorOptions<T = any> {
    field: keyof T & string
    direction?: 'asc' | 'desc'
    where?: Filter<T>
    limit?: number
    cursor?: string | null
}

export interface OperationEvent {
    source: string
    op: string
    durationMs: number
    error?: unknown
}

export type OperationHook = (event: OperationEvent) => void

export interface BaseRepositoryOptions {
    logger?: Logger
    slowQueryMs?: number
    /** Fires after every operation — success or failure. Use for tracing/metrics. */
    onOperation?: OperationHook
}

const DEFAULT_SLOW_QUERY_MS = 250

/**
 * Engine-agnostic repository contract + toolbox over a generic `Driver` handle.
 *
 * This base ships **no queries and no engine-specific code** — every data-access verb throws
 * `not implemented` and must be implemented by a subclass that knows its engine (Postgres,
 * MySQL, SQLite, MongoDB, DynamoDB, Redis, an HTTP API, …). What the base does provide:
 *
 * - the operation surface (the verbs below) as the contract a subclass fulfills;
 * - the engine-neutral query-description types (`Filter`, `Sort`, pagination);
 * - observability — `logger`, `slowQueryMs`, and the `onOperation` hook, wired through `time()`;
 * - transaction resolution via `run(trx)`.
 *
 * Implementations should wrap their work in `this.time(label, fn)` so timing, slow-query logging,
 * and the `onOperation` hook fire automatically.
 */
export abstract class BaseRepository<Entity = any, Driver = unknown> {

    protected readonly logger?: Logger
    protected readonly slowQueryMs: number
    protected readonly tracked: boolean
    protected readonly onOperation?: OperationHook

    protected constructor(
        protected readonly driver: Driver,
        protected readonly source: string,
        protected readonly idField: string = 'id',
        options: BaseRepositoryOptions = {},
    ) {
        this.logger = options.logger
        this.slowQueryMs = options.slowQueryMs ?? DEFAULT_SLOW_QUERY_MS
        this.onOperation = options.onOperation
        this.tracked = !!(this.logger?.warn || this.logger?.debug || this.onOperation)
    }

    get primaryKey(): string {
        return this.idField
    }

    /** Resolve the handle for a call — the transaction if supplied, else the base handle. */
    protected run(trx?: Driver): Driver {
        return trx ?? this.driver
    }

    protected byId(id: any): Filter<Entity> {
        return { [this.idField]: id } as Filter<Entity>
    }

    private report(label: string, elapsed: number, error?: unknown): void {
        if (elapsed >= this.slowQueryMs) {
            this.logger?.warn?.(`slow query: ${this.source}.${label} took ${elapsed}ms`, {
                source: this.source,
                op: label,
                durationMs: elapsed,
            })
        } else {
            this.logger?.debug?.(`${this.source}.${label} ${elapsed}ms`, {
                source: this.source,
                op: label,
                durationMs: elapsed,
            })
        }
        this.onOperation?.({ source: this.source, op: label, durationMs: elapsed, error })
    }

    /**
     * Run `fn`, timing it and reporting via `report` (slow-query log + `onOperation` hook).
     * Subclass verb implementations should wrap their data access in this.
     */
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

    async insert(_values: Record<string, any>, _trx?: Driver): Promise<Entity> {
        throw new Error('BaseRepository.insert: not implemented')
    }

    async insertMany(_values: Record<string, any>[], _trx?: Driver): Promise<Entity[]> {
        throw new Error('BaseRepository.insertMany: not implemented')
    }

    async upsert(_values: Record<string, any>, _options: UpsertOptions, _trx?: Driver): Promise<Entity> {
        throw new Error('BaseRepository.upsert: not implemented')
    }

    async findById(_id: any, _trx?: Driver): Promise<Entity | undefined> {
        throw new Error('BaseRepository.findById: not implemented')
    }

    async findByIdOrThrow(id: any, trx?: Driver): Promise<Entity> {
        const row = await this.findById(id, trx)
        if (!row) throw new NotFoundError(this.source, id)
        return row
    }

    async findByIdMany(_ids: readonly any[], _trx?: Driver): Promise<Entity[]> {
        throw new Error('BaseRepository.findByIdMany: not implemented')
    }

    async findOne(_where: Filter<Entity>, _trx?: Driver): Promise<Entity | undefined> {
        throw new Error('BaseRepository.findOne: not implemented')
    }

    async findOneOrThrow(where: Filter<Entity>, trx?: Driver): Promise<Entity> {
        const row = await this.findOne(where, trx)
        if (!row) throw new NotFoundError(this.source, JSON.stringify(where))
        return row
    }

    async findMany(_opts: ListOptions<Entity> = {}, _trx?: Driver): Promise<Entity[]> {
        throw new Error('BaseRepository.findMany: not implemented')
    }

    async findManyWithCount(
        _opts: ListOptions<Entity> = {},
        _trx?: Driver,
    ): Promise<{ results: Entity[]; total: number }> {
        throw new Error('BaseRepository.findManyWithCount: not implemented')
    }

    async paginate(_opts: PageOptions<Entity> = {}, _trx?: Driver): Promise<Page<Entity>> {
        throw new Error('BaseRepository.paginate: not implemented')
    }

    async paginateCursor(_opts: CursorOptions<Entity>, _trx?: Driver): Promise<CursorPage<Entity>> {
        throw new Error('BaseRepository.paginateCursor: not implemented')
    }

    async exists(_where: Filter<Entity>, _trx?: Driver): Promise<boolean> {
        throw new Error('BaseRepository.exists: not implemented')
    }

    async updateById(_id: any, _values: Record<string, any>, _trx?: Driver): Promise<Entity | undefined> {
        throw new Error('BaseRepository.updateById: not implemented')
    }

    async updateByIdOrThrow(id: any, values: Record<string, any>, trx?: Driver): Promise<Entity> {
        const row = await this.updateById(id, values, trx)
        if (!row) throw new NotFoundError(this.source, id)
        return row
    }

    async updateByIdAndVersion(
        _id: any,
        _expectedVersion: number,
        _values: Record<string, any>,
        _options: { versionColumn?: string } = {},
        _trx?: Driver,
    ): Promise<Entity> {
        throw new Error('BaseRepository.updateByIdAndVersion: not implemented')
    }

    async updateOne(_where: Filter<Entity>, _values: Record<string, any>, _trx?: Driver): Promise<Entity | undefined> {
        throw new Error('BaseRepository.updateOne: not implemented')
    }

    async update(_where: Filter<Entity>, _values: Record<string, any>, _trx?: Driver): Promise<number> {
        throw new Error('BaseRepository.update: not implemented')
    }

    async updateMany(ids: readonly any[], values: Record<string, any>, trx?: Driver): Promise<number> {
        if (ids.length === 0) return 0
        return this.update({ [this.idField]: ids } as Filter<Entity>, values, trx)
    }

    async deleteById(_id: any, _trx?: Driver): Promise<number> {
        throw new Error('BaseRepository.deleteById: not implemented')
    }

    async deleteByIdOrThrow(id: any, trx?: Driver): Promise<void> {
        const count = await this.deleteById(id, trx)
        if (count === 0) throw new NotFoundError(this.source, id)
    }

    async deleteMany(ids: readonly any[], trx?: Driver): Promise<number> {
        if (ids.length === 0) return 0
        return this.delete({ [this.idField]: ids } as Filter<Entity>, trx)
    }

    async delete(_where: Filter<Entity>, _trx?: Driver): Promise<number> {
        throw new Error('BaseRepository.delete: not implemented')
    }

    async count(_where?: Filter<Entity>, _trx?: Driver): Promise<number> {
        throw new Error('BaseRepository.count: not implemented')
    }
}
