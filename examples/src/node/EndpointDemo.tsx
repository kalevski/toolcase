import { NodeDemoCard } from './_demo/NodeDemo'

const code = `import type { FastifyInstance } from 'fastify'
import { RouteHandler, Router, HttpServer } from '@toolcase/node'

interface UserDTO {
    id: number
    email: string
    password: string  // writeOnly
    role: string      // private
}

class UsersEndpoint extends RouteHandler<UserDTO> {

    constructor(private readonly service: UserService) {
        super({
            prefix: '/users',
            resourceName: 'User',
            idType: 'integer',
            schema: {
                id:       { readonly: true,  type: 'integer' },
                email:    { required: true,  type: 'string', format: 'email' },
                password: { writeOnly: true, type: 'string', min: 8 },
                role:     { private: true,   type: 'string' },
            },
            strictInput: true,
        })
    }

    register(fastify: FastifyInstance) {
        fastify.get(this.path(), this.routeOptions(), async (req, reply) => {
            const query = this.sanitizeQuery(req.query as Record<string, unknown>, req)
            try {
                const page = await this.service.findPage(query as never)
                return this.ok(this.sanitizeOutput(page.results, req), page.pagination.count)
            } catch (error) {
                return this.mapError(error, reply)
            }
        })

        fastify.post(this.path(), this.routeOptions(), async (req, reply) => {
            try {
                const body = this.sanitizeInput(req.body, req) as UserDTO
                const created = await this.service.insert(body as never)
                return this.created(reply, this.sanitizeOutput(created, req))
            } catch (error) {
                return this.mapError(error, reply)
            }
        })

        fastify.delete(this.itemPath(), this.routeOptions(), async (req, reply) => {
            try {
                await this.service.deleteByIdOrThrow(this.parseId(req))
                return this.noContent(reply)
            } catch (error) {
                return this.mapError(error, reply)
            }
        })
    }
}

// Wire up the server
const server = new HttpServer({
    port: 3000,
    prefix: '/api/v1',
    healthCheck: () => db.raw('select 1'),
})
    .add(new Router().add(new UsersEndpoint(userService)))

await server.init()
await server.run()`

export const EndpointDemo = () => (
    <NodeDemoCard
        title="RouteHandler + HttpServer"
        description="RouteHandler base class wires schema-aware sanitize / id-parse / response envelope / domain-error → HTTP mapping. HttpServer is a thin Fastify wrapper with /health, CORS, prefixing, and lifecycle hooks. Server-side only."
        code={code}
    />
)

export default EndpointDemo
