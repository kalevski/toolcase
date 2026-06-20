import { describe, it, expect } from 'vitest'
import Status from '../src/http/Status'
import RESTError from '../src/http/RESTError'
import RESTResponse from '../src/http/RESTResponse'

describe('HTTP.Status', () => {
    it('has well-known codes', () => {
        expect(Status.OK).toBe(200)
        expect(Status.CREATED).toBe(201)
        expect(Status.BAD_REQUEST).toBe(400)
        expect(Status.NOT_FOUND).toBe(404)
        expect(Status.INTERNAL_SERVER_ERROR).toBe(500)
        expect(Status.IM_A_TEAPOT).toBe(418)
    })

    it('correctly-spelled aliases resolve to the same codes as the legacy typo keys', () => {
        expect(Status.NON_AUTHORITATIVE_INFORMATION).toBe(203)
        expect(Status.PARTIAL_CONTENT).toBe(206)
        expect(Status.NONAUTHORITATIVE_INFORMATION).toBe(203)
        expect(Status.PARCIAL_CONTENT).toBe(206)
    })
})

describe('HTTP.RESTError', () => {
    it('extends Error and stores status + message', () => {
        const e = new RESTError(404, 'gone')
        expect(e).toBeInstanceOf(Error)
        expect(e.status).toBe(404)
        expect(e.message).toBe('gone')
    })

    it('toJSON returns rejected envelope', () => {
        const e = new RESTError(500, 'boom')
        expect(e.toJSON()).toEqual({ status: 'rejected', cause: 'boom' })
    })

    it('static notFound builds 404 with default message', () => {
        const e = RESTError.notFound()
        expect(e.status).toBe(404)
        expect(e.message).toBe('resource not found')
    })

    it('static notImplemented builds 501', () => {
        expect(RESTError.notImplemented().status).toBe(501)
    })

    it('static internalServerError builds 500', () => {
        expect(RESTError.internalServerError().status).toBe(500)
    })

    it('JSON.stringify integrates with toJSON', () => {
        const e = new RESTError(403, 'denied')
        expect(JSON.parse(JSON.stringify(e))).toEqual({ status: 'rejected', cause: 'denied' })
    })
})

describe('HTTP.RESTResponse', () => {
    it('stores status and data', () => {
        const r = new RESTResponse(200, { ok: true })
        expect(r.status).toBe(200)
        expect(r.data).toEqual({ ok: true })
    })

    it('toJSON omits count when not provided', () => {
        const r = new RESTResponse(200, [1, 2])
        const json = r.toJSON()
        expect(json).toEqual({ status: 'OK', code: 200, data: [1, 2] })
        expect('count' in json).toBe(false)
    })

    it('toJSON omits count when explicitly null', () => {
        const r = new RESTResponse(200, [1, 2], null)
        expect('count' in r.toJSON()).toBe(false)
    })

    it('toJSON includes count when number provided', () => {
        const r = new RESTResponse(200, [1, 2], 2)
        expect(r.toJSON()).toEqual({ status: 'OK', code: 200, count: 2, data: [1, 2] })
    })

    it('JSON.stringify drops missing count', () => {
        const r = new RESTResponse(200, [1])
        const text = JSON.stringify(r)
        expect(text).not.toContain('count')
    })

    it('toJSON status is OK for 200', () => {
        expect(new RESTResponse(200, null).toJSON().status).toBe('OK')
    })

    it('toJSON status is rejected for 500', () => {
        expect(new RESTResponse(500, null).toJSON().status).toBe('rejected')
    })

    it('toJSON status is rejected for 400', () => {
        expect(new RESTResponse(400, null).toJSON().status).toBe('rejected')
    })

    it('toJSON code reflects real status', () => {
        expect(new RESTResponse(500, null).toJSON().code).toBe(500)
        expect(new RESTResponse(201, null).toJSON().code).toBe(201)
    })
})
