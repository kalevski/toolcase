import { describe, it, expect } from 'vitest'
import { resolveConfig, type ResolvableEnvVar } from '@/server/domain/config-resolution'

const T0 = '2026-01-01T00:00:00.000Z'
const T1 = '2026-01-02T00:00:00.000Z'
const T2 = '2026-01-03T00:00:00.000Z'

describe('resolveConfig', () => {
    it('resolves a literal as-is, never pending without a watermark', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'PORT', source: 'literal', value: '8080', updatedAt: T0 }]
        const result = resolveConfig(vars, new Map(), new Map(), new Map(), false)
        expect(result).toEqual({ env: [{ key: 'PORT', value: '8080', source: 'literal', masked: false, pending: false }], pending: [] })
    })

    it('resolves a global reference to the current global value', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'REGION', source: 'global', globalVarId: 'gvar_1', updatedAt: T0 }]
        const globals = new Map([['gvar_1', { value: 'eu-west-1', updatedAt: T0 }]])
        const result = resolveConfig(vars, globals, new Map(), new Map(), false)
        expect(result.env[0]).toEqual({ key: 'REGION', value: 'eu-west-1', source: 'global', masked: false, pending: false })
    })

    it('resolves a dangling global reference to an empty string', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'REGION', source: 'global', globalVarId: 'gone', updatedAt: T0 }]
        const result = resolveConfig(vars, new Map(), new Map(), new Map(), false)
        expect(result.env[0].value).toBe('')
    })

    it('masks a secret reference for an unauthorized caller', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'DB_PASS', source: 'secret', secretId: 'sec_1', updatedAt: T0 }]
        const secrets = new Map([['sec_1', { key: 'db_password', updatedAt: T0 }]])
        const result = resolveConfig(vars, new Map(), secrets, new Map(), false)
        expect(result.env[0]).toMatchObject({ value: '<hidden:db_password>', masked: true })
    })

    it('falls back to the var key when the secret reference is dangling and masked', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'DB_PASS', source: 'secret', secretId: 'gone', updatedAt: T0 }]
        const result = resolveConfig(vars, new Map(), new Map(), new Map(), false)
        expect(result.env[0].value).toBe('<hidden:DB_PASS>')
    })

    it('resolves the real secret value for an authorized caller', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'DB_PASS', source: 'secret', secretId: 'sec_1', updatedAt: T0 }]
        const secrets = new Map([['sec_1', { key: 'db_password', updatedAt: T0 }]])
        const values = new Map([['sec_1', 'hunter2']])
        const result = resolveConfig(vars, new Map(), secrets, values, true)
        expect(result.env[0]).toMatchObject({ value: 'hunter2', masked: false })
    })

    it('marks a row pending when its own updatedAt is after lastFetchAt', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'PORT', source: 'literal', value: '8080', updatedAt: T1 }]
        const result = resolveConfig(vars, new Map(), new Map(), new Map(), false, T0)
        expect(result.env[0].pending).toBe(true)
        expect(result.pending).toEqual(['PORT'])
    })

    it('marks a reference row pending when the REFERENCED global changed after lastFetchAt, even if the row itself did not', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'REGION', source: 'global', globalVarId: 'gvar_1', updatedAt: T0 }]
        const globals = new Map([['gvar_1', { value: 'eu-west-1', updatedAt: T1 }]])
        const result = resolveConfig(vars, globals, new Map(), new Map(), false, T0)
        expect(result.env[0].pending).toBe(true)
    })

    it('marks a secret-reference row pending when the referenced secret changed after lastFetchAt', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'DB_PASS', source: 'secret', secretId: 'sec_1', updatedAt: T0 }]
        const secrets = new Map([['sec_1', { key: 'db_password', updatedAt: T1 }]])
        const result = resolveConfig(vars, new Map(), secrets, new Map(), false, T0)
        expect(result.env[0].pending).toBe(true)
    })

    it('is not pending when everything predates lastFetchAt', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'PORT', source: 'literal', value: '8080', updatedAt: T0 }]
        const result = resolveConfig(vars, new Map(), new Map(), new Map(), false, T2)
        expect(result.env[0].pending).toBe(false)
        expect(result.pending).toEqual([])
    })

    it('never reports pending when lastFetchAt is undefined, regardless of timestamps', () => {
        const vars: ResolvableEnvVar[] = [{ key: 'PORT', source: 'literal', value: '8080', updatedAt: T2 }]
        const result = resolveConfig(vars, new Map(), new Map(), new Map(), false, undefined)
        expect(result.env[0].pending).toBe(false)
    })
})
