import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { RouteHandler } from '../src/RouteHandler'
import {
    NotFoundError,
    ConflictError,
    OptimisticLockError,
    RateLimitedError,
    LockNotAcquiredError,
    ValidationError,
} from '../src/errors'

class TestRouteHandler extends RouteHandler {

    register(_fastify: FastifyInstance): void {}

    callMapError(error: unknown, reply: FastifyReply): unknown {
        return this.mapError(error, reply)
    }
}

function makeReply() {
    const code = vi.fn().mockReturnThis()
    return { reply: { code } as unknown as FastifyReply, code }
}

describe('RouteHandler.mapError', () => {

    it('NotFoundError → 404 + cause NOT_FOUND', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new NotFoundError('User', 1), reply) as { status: string; cause: string }
        expect(code).toHaveBeenCalledWith(404)
        expect(body.cause).toBe('NOT_FOUND')
        expect(body.status).toBe('rejected')
    })

    it('ConflictError → 409 + cause CONFLICT', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new ConflictError('User'), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(409)
        expect(body.cause).toBe('CONFLICT')
    })

    it('OptimisticLockError → 409 + cause VERSION_MISMATCH', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new OptimisticLockError('User', 2, 1), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(409)
        expect(body.cause).toBe('VERSION_MISMATCH')
    })

    it('RateLimitedError → 429 + cause RATE_LIMITED', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new RateLimitedError('k', 30), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(429)
        expect(body.cause).toBe('RATE_LIMITED')
    })

    it('LockNotAcquiredError → 423 + cause LOCKED', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new LockNotAcquiredError('k'), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(423)
        expect(body.cause).toBe('LOCKED')
    })

    it('ValidationError → 400 + details', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new ValidationError('bad', { x: 1 }), reply) as { cause: string; details: unknown }
        expect(code).toHaveBeenCalledWith(400)
        expect(body.cause).toBe('VALIDATION_ERROR')
        expect(body.details).toEqual({ x: 1 })
    })

    it('unknown error → 500 + internal_error', () => {
        const ep = new TestRouteHandler()
        const { reply, code } = makeReply()
        const body = ep.callMapError(new Error('boom'), reply) as { cause: string }
        expect(code).toHaveBeenCalledWith(500)
        expect(body.cause).toBe('internal_error')
    })
})
