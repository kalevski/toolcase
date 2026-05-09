import { NodeDemoCard } from './_demo/NodeDemo'

const code = `import { Kysely } from 'kysely'
import { BaseRepository, EntityService, ConflictError, NotFoundError } from '@toolcase/node'

interface DB {
    users: {
        id: number
        email: string
        name: string
        created_at: Date
        deleted_at: Date | null
    }
}

class UserRepository extends BaseRepository<DB, 'users', 'id', number> {
    constructor(db: Kysely<DB>) {
        super(db, 'users', 'id', { slowQueryMs: 100 })
    }

    findByEmail(email: string) {
        return this.findOne({ email })
    }
}

class UserService extends EntityService<DB, 'users', 'id', number> {
    constructor(repo: UserRepository, db: Kysely<DB>) {
        super(repo, db)
    }

    protected async beforeInsert(values: { email: string; name: string }) {
        const existing = await (this.repository as UserRepository).findByEmail(values.email)
        if (existing) throw new ConflictError('User', \`email taken: \${values.email}\`)
        return values as never
    }
}

// Usage
const repo = new UserRepository(db)
const service = new UserService(repo, db)

const created = await service.insert({ email: 'a@b.c', name: 'Alice' })
const page    = await service.findPage({
    where:   { name: { ilike: '%alice%' } },
    orderBy: { column: 'created_at', direction: 'desc' },
    limit:   25,
    offset:  0,
})
const cursor  = await service.findCursorPage({ column: 'id', limit: 50 })

await service.transaction(async (trx) => {
    await service.updateByIdOrThrow(created.id, { name: 'Alice K.' }, trx)
    // throws NotFoundError if missing — auto-rolls back
})`

export const RepositoryDemo = () => (
    <NodeDemoCard
        title="Repository + EntityService"
        description="Kysely-backed CRUD with built-in pagination, cursor paging, optimistic locking, soft-delete, and before/after hooks. Server-side only — code shown is reference, not runnable in browser."
        code={code}
    />
)

export default RepositoryDemo
