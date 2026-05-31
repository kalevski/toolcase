import { useState } from 'react'
import {
    BaseRepository,
    EntityService,
    ConflictError,
    type TransactionClient,
    type Filter,
    type PageOptions,
    type Page,
} from '@toolcase/node'
import { captureLogsAsync, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

interface User {
    id: number
    email: string
    name: string
}

type Store = Map<number, User>

// @toolcase/node ships NO queries — BaseRepository is engine-agnostic. You implement
// the verbs for YOUR engine. The 2nd generic is the Driver (a pg Pool, a Mongo Db, …);
// here it's a plain in-memory Map, which proves the base assumes no SQL.
class UserRepository extends BaseRepository<User, Store> {
    private seq = 1
    constructor(store: Store) {
        super(store, 'users', 'id', { slowQueryMs: 50 })
    }

    // Only override the verbs you use — the rest inherit a 'not implemented' throw.
    async insert(values: Record<string, any>): Promise<User> {
        return this.time('insert', async () => {       // time() = slow-log + onOperation hook
            const row: User = { id: this.seq++, ...(values as Omit<User, 'id'>) }
            this.run().set(row.id, row)
            return row
        })
    }

    async findById(id: number): Promise<User | undefined> {
        return this.run().get(id)
    }

    async findOne(where: Filter<User>): Promise<User | undefined> {
        // Translate the engine-neutral Filter however your engine wants. Minimal
        // eq-only matcher here; a SQL repo would build a parameterized WHERE clause.
        const entries = Object.entries(where) as [keyof User, unknown][]
        return [...this.run().values()].find((row) => entries.every(([k, v]) => row[k] === v))
    }

    async paginate(opts: PageOptions<User> = {}): Promise<Page<User>> {
        const all = [...this.run().values()]
        const offset = opts.offset ?? 0
        const limit = opts.limit ?? 25
        return { results: all.slice(offset, offset + limit), pagination: { offset, limit, count: all.length } }
    }

    async count(): Promise<number> {
        return this.run().size
    }

    findByEmail(email: string) {
        return this.findOne({ email } as Filter<User>)
    }
}

class UserService extends EntityService<User, Store> {
    constructor(repo: UserRepository, db: TransactionClient<Store>) {
        super(repo, db)
    }

    protected async beforeInsert(values: Record<string, any>) {
        const taken = await (this.repository as UserRepository).findByEmail(values.email)
        if (taken) throw new ConflictError('User', `email taken: ${values.email}`)
        return values
    }
}

const code = `import {
    BaseRepository, EntityService, ConflictError,
    type TransactionClient, type Filter, type PageOptions, type Page,
} from '@toolcase/node'

type Store = Map<number, User>

// BaseRepository ships no queries — implement the verbs for your engine.
// 2nd generic = Driver (pg Pool, Mongo Db, …); here a plain Map. run(trx)
// hands back the trx handle or the base driver.
class UserRepository extends BaseRepository<User, Store> {
    private seq = 1
    constructor(store: Store) { super(store, 'users', 'id', { slowQueryMs: 50 }) }

    async insert(values: Record<string, any>): Promise<User> {
        return this.time('insert', async () => {        // slow-log + onOperation hook
            const row: User = { id: this.seq++, ...(values as Omit<User, 'id'>) }
            this.run().set(row.id, row)
            return row
        })
    }
    async findById(id: number) { return this.run().get(id) }
    async findOne(where: Filter<User>) {
        const entries = Object.entries(where) as [keyof User, unknown][]
        return [...this.run().values()].find(r => entries.every(([k, v]) => r[k] === v))
    }
    async paginate(opts: PageOptions<User> = {}): Promise<Page<User>> {
        const all = [...this.run().values()]
        const offset = opts.offset ?? 0, limit = opts.limit ?? 25
        return { results: all.slice(offset, offset + limit), pagination: { offset, limit, count: all.length } }
    }
    async count() { return this.run().size }
    findByEmail(email: string) { return this.findOne({ email } as Filter<User>) }
}

class UserService extends EntityService<User, Store> {
    constructor(repo: UserRepository, db: TransactionClient<Store>) { super(repo, db) }
    protected async beforeInsert(values: Record<string, any>) {
        const taken = await (this.repository as UserRepository).findByEmail(values.email)
        if (taken) throw new ConflictError('User', \`email taken: \${values.email}\`)
        return values
    }
}

// Wire it. TransactionClient is the neutral "can run a transaction" contract —
// for an in-memory store it just runs the callback with the store.
const store: Store = new Map()
const db: TransactionClient<Store> = { transaction: (fn) => fn(store) }
const service = new UserService(new UserRepository(store), db)

const alice = await service.insert({ email: 'alice@toolcase.dev', name: 'Alice' })
await service.insert({ email: 'alice@toolcase.dev', name: 'Dup' })   // throws ConflictError
const page = await service.paginate({ limit: 10 })`

export const RepositoryDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        void (async () => {
            setLogs(await captureLogsAsync(async () => {
                const store: Store = new Map()
                const db: TransactionClient<Store> = { transaction: (fn) => fn(store) }
                const service = new UserService(new UserRepository(store), db)

                const alice = await service.insert({ email: 'alice@toolcase.dev', name: 'Alice' })
                console.log('inserted:', alice)
                await service.insert({ email: 'bob@toolcase.dev', name: 'Bob' })
                console.log('findById(1):', await service.findById(1))

                try {
                    await service.insert({ email: 'alice@toolcase.dev', name: 'Dup' })
                } catch (e) {
                    console.log('beforeInsert hook →', (e as Error).message)
                }

                console.log('count:', await service.count())
                console.log('paginate:', await service.paginate({ limit: 10 }))
            }))
        })()
    }
    return (
        <NodeDemoCard
            title="Repository + EntityService"
            description="Extend the engine-agnostic BaseRepository and implement the verbs for your engine — here a plain in-memory Map, proving the base ships no SQL. EntityService layers before/after hooks. Runs live in the browser."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default RepositoryDemo
