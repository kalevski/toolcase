import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify'
import { RESTRouteHandler } from '../src/RESTRouteHandler'
import { EntityService } from '../src/EntityService'
import { NotFoundError, ConflictError, OptimisticLockError } from '../src/errors'

interface UserRow {
    id: number
    email: string
    age: number
    status: string
    name: string
    passwordHash: string
    createdAt: Date
}

type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

interface CapturedRoute {
    method: 'get' | 'post' | 'patch' | 'delete'
    path: string
    opts: RouteShorthandOptions
    handler: Handler
}

function makeFastifyStub() {
    const routes: CapturedRoute[] = []
    const make = (method: CapturedRoute['method']) =>
        vi.fn((path: string, opts: RouteShorthandOptions, handler: Handler) => {
            routes.push({ method, path, opts, handler })
        })
    return {
        fastify: {
            get: make('get'),
            post: make('post'),
            patch: make('patch'),
            delete: make('delete'),
        } as unknown as FastifyInstance,
        routes,
    }
}

function makeReq(partial: Partial<FastifyRequest> = {}): FastifyRequest {
    return {
        params: {},
        query: {},
        body: undefined,
        headers: {},
        ...partial,
    } as unknown as FastifyRequest
}

function makeReply() {
    const code = vi.fn().mockReturnThis()
    return { reply: { code } as unknown as FastifyReply, code }
}

interface MockServiceState {
    paginate: ReturnType<typeof vi.fn>
    findById: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    updateByIdOrThrow: ReturnType<typeof vi.fn>
    deleteByIdOrThrow: ReturnType<typeof vi.fn>
}

function makeService(): { service: EntityService<{ users: UserRow }, 'users', 'id', number>; state: MockServiceState } {
    const state: MockServiceState = {
        paginate: vi.fn(),
        findById: vi.fn(),
        insert: vi.fn(),
        updateByIdOrThrow: vi.fn(),
        deleteByIdOrThrow: vi.fn(),
    }
    const service = state as unknown as EntityService<{ users: UserRow }, 'users', 'id', number>
    return { service, state }
}

class UserEndpoint extends RESTRouteHandler<{ users: UserRow }, 'users', 'id', number> {}

describe('RESTRouteHandler.register', () => {

    it('attaches 5 routes by default', () => {
        const { service } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer' })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        expect(routes.length).toBe(5)
        const sig = routes.map((r) => `${r.method} ${r.path}`)
        expect(sig).toEqual([
            'get /users',
            'get /users/:id',
            'post /users',
            'patch /users/:id',
            'delete /users/:id',
        ])
    })

    it('respects methods filter', () => {
        const { service } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', methods: ['list', 'get'], idType: 'integer' })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        expect(routes.length).toBe(2)
    })

    it('prefix nesting', () => {
        const { service } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/api/users', idType: 'integer' })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        expect(routes[0].path).toBe('/api/users')
        expect(routes[1].path).toBe('/api/users/:id')
    })
})

describe('RESTRouteHandler.list', () => {

    function setup(opts: Parameters<typeof UserEndpoint.prototype.constructor>[1] = {}) {
        const { service, state } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer', ...opts })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        const list = routes.find((r) => r.method === 'get' && r.path === '/users')!
        return { ep, state, list }
    }

    it('calls service.paginate with parsed where + orderBy + offset + limit', async () => {
        const { state, list } = setup({
            filterableFields: ['email', 'status'],
            sortableFields: ['createdAt'],
        })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { email: 'foo', status: { in: 'a,b' }, sort: '-createdAt' } }), reply)
        expect(state.paginate).toHaveBeenCalledTimes(1)
        const arg = state.paginate.mock.calls[0][0]
        expect(arg.where).toEqual({ email: 'foo', status: { in: ['a', 'b'] } })
        expect(arg.orderBy).toEqual([{ field: 'createdAt', direction: 'desc' }])
        expect(arg.offset).toBe(0)
        expect(arg.limit).toBe(25)
    })

    it('returns RESTResponse envelope with count', async () => {
        const { state, list } = setup()
        state.paginate.mockResolvedValue({
            results: [{ id: 1, email: 'a' }],
            pagination: { offset: 0, limit: 25, count: 42 },
        })
        const { reply } = makeReply()
        const out = await list.handler(makeReq(), reply) as { count?: number }
        expect(out.count).toBe(42)
    })

    it('multi-op same field', async () => {
        const { state, list } = setup({ filterableFields: ['age'], schema: { age: { type: 'integer' } } })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { age: { gte: '18', lt: '65' } } }), reply)
        expect(state.paginate.mock.calls[0][0].where).toEqual({ age: { gte: 18, lt: 65 } })
    })

    it('400 when filter field not in filterableFields', async () => {
        const { state, list } = setup({ filterableFields: ['email'] })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply, code } = makeReply()
        const body = await list.handler(makeReq({ query: { status: 'x' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
    })

    it('falls back to defaultOrderBy when sort absent', async () => {
        const { state, list } = setup({ defaultOrderBy: { field: 'createdAt', direction: 'desc' } })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq(), reply)
        expect(state.paginate.mock.calls[0][0].orderBy).toEqual({ field: 'createdAt', direction: 'desc' })
    })

    it('coerces filters via schema', async () => {
        const { state, list } = setup({
            filterableFields: ['age'],
            schema: { age: { type: 'integer' } },
        })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { age: { gte: '18' } } }), reply)
        expect(state.paginate.mock.calls[0][0].where).toEqual({ age: { gte: 18 } })
    })

    it('without schema, no coercion', async () => {
        const { state, list } = setup({ filterableFields: ['age'] })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { age: { gte: '18' } } }), reply)
        expect(state.paginate.mock.calls[0][0].where).toEqual({ age: { gte: '18' } })
    })

    it('schema without filterable flag → field rejected even though readable', async () => {
        const { list } = setup({ schema: { email: {}, status: {} } })
        const { reply, code } = makeReply()
        const body = await list.handler(makeReq({ query: { email: 'x' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
    })

    it('schema with filterable:true → field accepted for filtering', async () => {
        const { state, list } = setup({ schema: { email: { filterable: true }, status: {} } })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { email: 'x' } }), reply)
        expect(state.paginate.mock.calls[0][0].where).toEqual({ email: 'x' })
    })

    it('schema without sortable flag → sort on that field is rejected', async () => {
        const { list } = setup({ schema: { createdAt: {} } })
        const { reply, code } = makeReply()
        const body = await list.handler(makeReq({ query: { sort: 'createdAt' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
    })

    it('schema with sortable:true → sort on that field is accepted', async () => {
        const { state, list } = setup({ schema: { createdAt: { sortable: true } } })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { sort: 'createdAt' } }), reply)
        expect(state.paginate.mock.calls[0][0].orderBy).toEqual([{ field: 'createdAt', direction: 'asc' }])
    })

    it('explicit filterableFields override schema flags', async () => {
        const { state, list } = setup({ filterableFields: ['status'], schema: { status: {} } })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { status: 'active' } }), reply)
        expect(state.paginate.mock.calls[0][0].where).toEqual({ status: 'active' })
    })

    it('explicit sortableFields override schema flags', async () => {
        const { state, list } = setup({ sortableFields: ['name'], schema: { name: {} } })
        state.paginate.mockResolvedValue({ results: [], pagination: { offset: 0, limit: 25, count: 0 } })
        const { reply } = makeReply()
        await list.handler(makeReq({ query: { sort: 'name' } }), reply)
        expect(state.paginate.mock.calls[0][0].orderBy).toEqual([{ field: 'name', direction: 'asc' }])
    })

    it('hides restrictedOutputFields on every row', async () => {
        const { state, list } = setup({ restrictedOutputFields: ['passwordHash'] })
        state.paginate.mockResolvedValue({
            results: [{ id: 1, passwordHash: 'secret' }, { id: 2, passwordHash: 'secret2' }],
            pagination: { offset: 0, limit: 25, count: 2 },
        })
        const { reply } = makeReply()
        const out = await list.handler(makeReq(), reply) as { data: Array<Record<string, unknown>> }
        expect(out.data[0].passwordHash).toBeUndefined()
        expect(out.data[1].passwordHash).toBeUndefined()
    })
})

describe('RESTRouteHandler.getOne', () => {

    function setup() {
        const { service, state } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer', resourceName: 'User' })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        const get = routes.find((r) => r.method === 'get' && r.path === '/users/:id')!
        return { state, get }
    }

    it('200 when found', async () => {
        const { state, get } = setup()
        state.findById.mockResolvedValue({ id: 1, email: 'a' })
        const { reply } = makeReply()
        const out = await get.handler(makeReq({ params: { id: '1' } }), reply) as { data: { id: number } }
        expect(out.data.id).toBe(1)
    })

    it('404 when not found', async () => {
        const { state, get } = setup()
        state.findById.mockResolvedValue(undefined)
        const { reply, code } = makeReply()
        const body = await get.handler(makeReq({ params: { id: '1' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(404)
        expect(body.cause).toBe('NOT_FOUND')
    })

    it('400 on bad id', async () => {
        const { get } = setup()
        const { reply, code } = makeReply()
        const body = await get.handler(makeReq({ params: { id: 'abc' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
    })
})

describe('RESTRouteHandler.create', () => {

    function setup(opts: Parameters<typeof UserEndpoint.prototype.constructor>[1] = {}) {
        const { service, state } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer', ...opts })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        const create = routes.find((r) => r.method === 'post')!
        return { state, create }
    }

    it('201 + forwards sanitized body', async () => {
        const { state, create } = setup()
        state.insert.mockResolvedValue({ id: 1, email: 'a' })
        const { reply, code } = makeReply()
        await create.handler(makeReq({ body: { email: 'a' } }), reply)
        expect(code).toHaveBeenCalledWith(201)
        expect(state.insert).toHaveBeenCalledWith({ email: 'a' })
    })

    it('strict input drops unknown fields silently', async () => {
        const schema = { email: {} }
        const { state, create } = setup({ schema, strictInput: true })
        state.insert.mockResolvedValue({ id: 1 })
        const { reply } = makeReply()
        await create.handler(makeReq({ body: { email: 'a', evil: 'x' } }), reply)
        expect(state.insert).toHaveBeenCalledWith({ email: 'a' })
    })

    it('400 when body null', async () => {
        const { create } = setup()
        const { reply, code } = makeReply()
        const body = await create.handler(makeReq({ body: null }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
    })

    it('409 on ConflictError from service', async () => {
        const { state, create } = setup()
        state.insert.mockRejectedValue(new ConflictError('User'))
        const { reply, code } = makeReply()
        const body = await create.handler(makeReq({ body: { email: 'a' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(409)
        expect(body.cause).toBe('CONFLICT')
    })
})

describe('RESTRouteHandler.update', () => {

    function setup(opts: Parameters<typeof UserEndpoint.prototype.constructor>[1] = {}) {
        const { service, state } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer', ...opts })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        const patch = routes.find((r) => r.method === 'patch')!
        return { state, patch }
    }

    it('200 + forwards sanitized body', async () => {
        const { state, patch } = setup()
        state.updateByIdOrThrow.mockResolvedValue({ id: 1, email: 'b' })
        const { reply } = makeReply()
        await patch.handler(makeReq({ params: { id: '1' }, body: { email: 'b' } }), reply)
        expect(state.updateByIdOrThrow).toHaveBeenCalledWith(1, { email: 'b' })
    })

    it('400 when body null', async () => {
        const { patch } = setup()
        const { reply, code } = makeReply()
        await patch.handler(makeReq({ params: { id: '1' }, body: null }), reply)
        expect(code).toHaveBeenCalledWith(400)
    })

    it('400 when sanitized body empty (default allowEmptyPatch=false)', async () => {
        const { state, patch } = setup()
        const { reply, code } = makeReply()
        const body = await patch.handler(makeReq({ params: { id: '1' }, body: {} }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
        expect(state.updateByIdOrThrow).not.toHaveBeenCalled()
    })

    it('allowEmptyPatch:true → calls service with empty body', async () => {
        const { state, patch } = setup({ allowEmptyPatch: true })
        state.updateByIdOrThrow.mockResolvedValue({ id: 1 })
        const { reply } = makeReply()
        await patch.handler(makeReq({ params: { id: '1' }, body: {} }), reply)
        expect(state.updateByIdOrThrow).toHaveBeenCalledWith(1, {})
    })

    it('404 when service throws NotFoundError', async () => {
        const { state, patch } = setup()
        state.updateByIdOrThrow.mockRejectedValue(new NotFoundError('User', 1))
        const { reply, code } = makeReply()
        const body = await patch.handler(makeReq({ params: { id: '1' }, body: { email: 'b' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(404)
        expect(body.cause).toBe('NOT_FOUND')
    })

    it('409 VERSION_MISMATCH on OptimisticLockError', async () => {
        const { state, patch } = setup()
        state.updateByIdOrThrow.mockRejectedValue(new OptimisticLockError('User', 2, 1))
        const { reply, code } = makeReply()
        const body = await patch.handler(makeReq({ params: { id: '1' }, body: { email: 'b' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(409)
        expect(body.cause).toBe('VERSION_MISMATCH')
    })
})

describe('RESTRouteHandler.delete', () => {

    function setup() {
        const { service, state } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer' })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        const del = routes.find((r) => r.method === 'delete')!
        return { state, del }
    }

    it('204 on success', async () => {
        const { state, del } = setup()
        state.deleteByIdOrThrow.mockResolvedValue(undefined)
        const { reply, code } = makeReply()
        const out = await del.handler(makeReq({ params: { id: '1' } }), reply)
        expect(code).toHaveBeenCalledWith(204)
        expect(out).toBeNull()
        expect(state.deleteByIdOrThrow).toHaveBeenCalledWith(1)
    })

    it('404 when service throws NotFoundError', async () => {
        const { state, del } = setup()
        state.deleteByIdOrThrow.mockRejectedValue(new NotFoundError('User', 1))
        const { reply, code } = makeReply()
        const body = await del.handler(makeReq({ params: { id: '1' } }), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(404)
        expect(body.cause).toBe('NOT_FOUND')
    })
})

describe('RESTRouteHandler pre-handler resolution', () => {

    function setup(opts: Parameters<typeof UserEndpoint.prototype.constructor>[1]) {
        const { service } = makeService()
        const ep = new UserEndpoint(service, { prefix: '/users', idType: 'integer', ...opts })
        const { fastify, routes } = makeFastifyStub()
        ep.register(fastify)
        return routes
    }

    it('per-verb wins over alias', () => {
        const verbHandler = vi.fn()
        const aliasHandler = vi.fn()
        const routes = setup({ canList: verbHandler, canRead: aliasHandler })
        const list = routes.find((r) => r.method === 'get' && r.path === '/users')!
        const handlers = (list.opts.preHandler ?? []) as unknown[]
        expect(handlers).toContain(verbHandler)
        expect(handlers).not.toContain(aliasHandler)
    })

    it('alias fills verb without explicit per-verb', () => {
        const aliasHandler = vi.fn()
        const routes = setup({ canRead: aliasHandler })
        const list = routes.find((r) => r.method === 'get' && r.path === '/users')!
        const get = routes.find((r) => r.method === 'get' && r.path === '/users/:id')!
        expect((list.opts.preHandler ?? []) as unknown[]).toContain(aliasHandler)
        expect((get.opts.preHandler ?? []) as unknown[]).toContain(aliasHandler)
    })

    it('canWrite covers create/update/delete only', () => {
        const writeHandler = vi.fn()
        const routes = setup({ canWrite: writeHandler })
        const list = routes.find((r) => r.method === 'get' && r.path === '/users')!
        const post = routes.find((r) => r.method === 'post')!
        const patch = routes.find((r) => r.method === 'patch')!
        const del = routes.find((r) => r.method === 'delete')!
        expect((list.opts.preHandler ?? []) as unknown[]).not.toContain(writeHandler)
        expect((post.opts.preHandler ?? []) as unknown[]).toContain(writeHandler)
        expect((patch.opts.preHandler ?? []) as unknown[]).toContain(writeHandler)
        expect((del.opts.preHandler ?? []) as unknown[]).toContain(writeHandler)
    })

    it('global preHandlers run before per-verb', () => {
        const globalHandler = vi.fn()
        const verbHandler = vi.fn()
        const routes = setup({ preHandlers: [globalHandler], canList: verbHandler })
        const list = routes.find((r) => r.method === 'get' && r.path === '/users')!
        const handlers = list.opts.preHandler as unknown[]
        expect(handlers[0]).toBe(globalHandler)
        expect(handlers[1]).toBe(verbHandler)
    })
})
