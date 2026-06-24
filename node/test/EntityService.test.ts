import { describe, it, expect, vi } from 'vitest'
import { EntityService, HookContext } from '../src/EntityService'
import { BaseRepository } from '../src/BaseRepository'
import { TransactionClient } from '../src/utils/transaction'

type FakeDriver = { id: symbol }

/** Minimal fake repository — only the methods EntityService calls. */
function makeFakeRepo(overrides: Partial<BaseRepository<any, FakeDriver>> = {}): BaseRepository<any, FakeDriver> {
    return {
        primaryKey: 'id',
        insert: vi.fn(async (values: any) => ({ id: 1, ...values })),
        insertMany: vi.fn(async (values: any[]) => values.map((v, i) => ({ id: i + 1, ...v }))),
        ...overrides,
    } as unknown as BaseRepository<any, FakeDriver>
}

/**
 * Fake TransactionClient. Calls `fn` with a fresh driver handle and re-throws on error
 * (simulating a rolled-back transaction). Records whether the callback threw.
 */
function makeFakeDb(): { db: TransactionClient<FakeDriver>; didRollback: () => boolean } {
    let rolledBack = false
    const db: TransactionClient<FakeDriver> = {
        async transaction<T>(fn: (trx: FakeDriver) => Promise<T>): Promise<T> {
            const trx: FakeDriver = { id: Symbol('trx') }
            try {
                return await fn(trx)
            } catch (e) {
                rolledBack = true
                throw e
            }
        },
    }
    return { db, didRollback: () => rolledBack }
}

describe('EntityService — transactional hooks', () => {

    describe('insert', () => {

        it('wraps hook+write in a transaction when no trx is supplied', async () => {
            const repo = makeFakeRepo()
            const { db } = makeFakeDb()
            const txSpy = vi.spyOn(db, 'transaction')

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            const svc = new Svc()
            await svc.insert({ name: 'alice' })

            expect(txSpy).toHaveBeenCalledOnce()
            expect(repo.insert).toHaveBeenCalledOnce()
        })

        it('passes the transaction handle to repo.insert', async () => {
            let capturedTrx: FakeDriver | undefined
            const repo = makeFakeRepo({
                insert: vi.fn(async (values: any, trx: FakeDriver) => {
                    capturedTrx = trx
                    return { id: 1, ...values }
                }),
            })
            const { db } = makeFakeDb()

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            await new Svc().insert({ name: 'alice' })
            expect(capturedTrx).toBeDefined()
        })

        it('rolls back (propagates throw) when afterInsert throws', async () => {
            const repo = makeFakeRepo()
            const { db, didRollback } = makeFakeDb()

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
                protected override afterInsert(_row: any, _ctx: HookContext<FakeDriver>): never {
                    throw new Error('audit failed')
                }
            }

            await expect(new Svc().insert({ name: 'bob' })).rejects.toThrow('audit failed')
            // repo.insert ran inside the tx, but the tx callback threw → rollback
            expect(repo.insert).toHaveBeenCalledOnce()
            expect(didRollback()).toBe(true)
        })

        it('uses the caller-supplied trx directly without opening a new one', async () => {
            const repo = makeFakeRepo()
            const { db } = makeFakeDb()
            const txSpy = vi.spyOn(db, 'transaction')
            const callerTrx: FakeDriver = { id: Symbol('outer') }

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            await new Svc().insert({ name: 'carol' }, callerTrx)
            expect(txSpy).not.toHaveBeenCalled()
            expect(repo.insert).toHaveBeenCalledWith(expect.anything(), callerTrx)
        })

    })

    describe('insertMany', () => {

        it('runs beforeInsert and afterInsert unconditionally for each row', async () => {
            const repo = makeFakeRepo()
            const { db } = makeFakeDb()

            const beforeCalls: any[] = []
            const afterCalls: any[] = []

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
                protected override beforeInsert(values: Record<string, any>, ctx: HookContext<FakeDriver>) {
                    beforeCalls.push({ values, trx: ctx.trx })
                    return { ...values, tagged: true }
                }
                protected override afterInsert(row: any, ctx: HookContext<FakeDriver>) {
                    afterCalls.push({ row, trx: ctx.trx })
                    return { ...row, audited: true }
                }
            }

            const results = await new Svc().insertMany([{ name: 'a' }, { name: 'b' }])

            expect(beforeCalls).toHaveLength(2)
            expect(afterCalls).toHaveLength(2)
            // beforeInsert mutation is forwarded to the repo
            expect(repo.insertMany).toHaveBeenCalledWith(
                [{ name: 'a', tagged: true }, { name: 'b', tagged: true }],
                expect.anything(),
            )
            // afterInsert mutation is reflected in the return value
            expect(results[0]).toMatchObject({ audited: true })
            expect(results[1]).toMatchObject({ audited: true })
        })

        it('runs hooks with the same transaction handle for every row', async () => {
            const repo = makeFakeRepo()
            const { db } = makeFakeDb()

            const seenTrxs = new Set<FakeDriver>()

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
                protected override beforeInsert(values: Record<string, any>, ctx: HookContext<FakeDriver>) {
                    if (ctx.trx) seenTrxs.add(ctx.trx)
                    return values
                }
            }

            await new Svc().insertMany([{ name: 'a' }, { name: 'b' }, { name: 'c' }])

            // All three rows share the same transaction handle opened by withTrx
            expect(seenTrxs.size).toBe(1)
        })

        it('rolls back when afterInsert throws for any row', async () => {
            const repo = makeFakeRepo()
            const { db, didRollback } = makeFakeDb()

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
                protected override afterInsert(_row: any, _ctx: HookContext<FakeDriver>): never {
                    throw new Error('post-insert hook failed')
                }
            }

            await expect(new Svc().insertMany([{ name: 'x' }])).rejects.toThrow('post-insert hook failed')
            expect(didRollback()).toBe(true)
        })

        it('returns [] immediately without opening a transaction when values is empty', async () => {
            const repo = makeFakeRepo()
            const { db } = makeFakeDb()
            const txSpy = vi.spyOn(db, 'transaction')

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            const result = await new Svc().insertMany([])
            expect(result).toEqual([])
            expect(txSpy).not.toHaveBeenCalled()
        })

    })

    describe('upsert', () => {

        it('wraps hook+write in a transaction', async () => {
            const repo = makeFakeRepo({
                upsert: vi.fn(async (values: any) => ({ id: 1, ...values })),
            })
            const { db } = makeFakeDb()
            const txSpy = vi.spyOn(db, 'transaction')

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            await new Svc().upsert({ name: 'alice' }, { uniqueBy: ['name'] })
            expect(txSpy).toHaveBeenCalledOnce()
        })

    })

    describe('updateById', () => {

        it('wraps hook+write in a transaction', async () => {
            const repo = makeFakeRepo({
                updateById: vi.fn(async (_id: any, values: any) => ({ id: 1, ...values })),
            })
            const { db } = makeFakeDb()
            const txSpy = vi.spyOn(db, 'transaction')

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            await new Svc().updateById(1, { name: 'updated' })
            expect(txSpy).toHaveBeenCalledOnce()
        })

        it('rolls back when afterUpdate throws', async () => {
            const repo = makeFakeRepo({
                updateById: vi.fn(async (_id: any, values: any) => ({ id: 1, ...values })),
            })
            const { db, didRollback } = makeFakeDb()

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
                protected override afterUpdate(_row: any, _ctx: HookContext<FakeDriver>): never {
                    throw new Error('audit row failed')
                }
            }

            await expect(new Svc().updateById(1, { name: 'x' })).rejects.toThrow('audit row failed')
            expect(didRollback()).toBe(true)
        })

    })

    describe('deleteById', () => {

        it('wraps hook+write in a transaction', async () => {
            const repo = makeFakeRepo({
                deleteById: vi.fn(async () => 1),
            })
            const { db } = makeFakeDb()
            const txSpy = vi.spyOn(db, 'transaction')

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
            }

            await new Svc().deleteById(1)
            expect(txSpy).toHaveBeenCalledOnce()
        })

        it('rolls back when afterDelete throws', async () => {
            const repo = makeFakeRepo({
                deleteById: vi.fn(async () => 1),
            })
            const { db, didRollback } = makeFakeDb()

            class Svc extends EntityService<any, FakeDriver> {
                constructor() { super(repo, db) }
                protected override afterDelete(_count: number, _ctx: HookContext<FakeDriver>): never {
                    throw new Error('delete audit failed')
                }
            }

            await expect(new Svc().deleteById(1)).rejects.toThrow('delete audit failed')
            expect(didRollback()).toBe(true)
        })

    })

})
