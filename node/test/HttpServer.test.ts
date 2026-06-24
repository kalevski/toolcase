import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the options that fastify() is called with.
type CapturedCall = Record<string, unknown>
let lastFastifyCall: CapturedCall | undefined

vi.mock('fastify', () => {
    const factory = vi.fn((opts?: CapturedCall) => {
        lastFastifyCall = opts ?? {}
        return {
            register: vi.fn().mockResolvedValue(undefined),
            get: vi.fn(),
            setNotFoundHandler: vi.fn(),
            listen: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
        }
    })
    return { default: factory }
})

import { HttpServer } from '../src/HttpServer'

beforeEach(() => {
    lastFastifyCall = undefined
    vi.clearAllMocks()
})

describe('HttpServer — fastify options', () => {

    it('trustProxy defaults to false', async () => {
        const server = new HttpServer({ port: 3000 })
        await server.init()
        expect(lastFastifyCall?.trustProxy).toBe(false)
    })

    it('trustProxy can be opted in', async () => {
        const server = new HttpServer({ port: 3000, trustProxy: true })
        await server.init()
        expect(lastFastifyCall?.trustProxy).toBe(true)
    })

    it('requestTimeout defaults to 30 000 ms', async () => {
        const server = new HttpServer({ port: 3000 })
        await server.init()
        expect(lastFastifyCall?.requestTimeout).toBe(30_000)
    })

    it('requestTimeoutMs is forwarded as requestTimeout', async () => {
        const server = new HttpServer({ port: 3000, requestTimeoutMs: 5_000 })
        await server.init()
        expect(lastFastifyCall?.requestTimeout).toBe(5_000)
    })

    it('connectionTimeout defaults to 0', async () => {
        const server = new HttpServer({ port: 3000 })
        await server.init()
        expect(lastFastifyCall?.connectionTimeout).toBe(0)
    })

    it('connectionTimeoutMs is forwarded as connectionTimeout', async () => {
        const server = new HttpServer({ port: 3000, connectionTimeoutMs: 10_000 })
        await server.init()
        expect(lastFastifyCall?.connectionTimeout).toBe(10_000)
    })

    it('keepAliveTimeout defaults to 72 000 ms', async () => {
        const server = new HttpServer({ port: 3000 })
        await server.init()
        expect(lastFastifyCall?.keepAliveTimeout).toBe(72_000)
    })

    it('keepAliveTimeoutMs is forwarded as keepAliveTimeout', async () => {
        const server = new HttpServer({ port: 3000, keepAliveTimeoutMs: 60_000 })
        await server.init()
        expect(lastFastifyCall?.keepAliveTimeout).toBe(60_000)
    })
})
