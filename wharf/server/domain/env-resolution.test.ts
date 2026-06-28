import { describe, it, expect } from 'vitest'
import { resolveConfig, type EnvRow, type ResolveInput } from '@/server/domain/env-resolution'

const T0 = '2026-01-01T00:00:00.000Z'
const T1 = '2026-02-01T00:00:00.000Z'
const T2 = '2026-03-01T00:00:00.000Z'

function literal(key: string, value: string, opts: Partial<EnvRow> = {}): EnvRow {
    return { key, source: 'literal', value, required: false, updatedAt: T0, ...opts }
}

function secretRef(key: string, secretId: string, opts: Partial<EnvRow> = {}): EnvRow {
    return { key, source: 'secret_ref', secretId, required: false, updatedAt: T0, ...opts }
}

function baseInput(over: Partial<ResolveInput> = {}): ResolveInput {
    return {
        baseline: [],
        overrides: [],
        canReadSecrets: false,
        secretMeta: {},
        ...over,
    }
}

describe('resolveConfig', () => {
    it('resolves baseline-only literals in declaration order', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('A', 'one'), literal('B', 'two')],
            }),
        )
        expect(out.env.map((e) => [e.key, e.value])).toEqual([
            ['A', 'one'],
            ['B', 'two'],
        ])
        expect(out.missingRequired).toEqual([])
        expect(out.pending).toEqual([])
    })

    it('lets an instance override win over baseline (decision #1)', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('A', 'base')],
                overrides: [literal('A', 'override')],
            }),
        )
        expect(out.env).toHaveLength(1)
        expect(out.env[0]).toMatchObject({ key: 'A', value: 'override', source: 'literal' })
    })

    it('appends override-only keys after baseline keys in stable order', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('A', 'a')],
                overrides: [literal('Z', 'z')],
            }),
        )
        expect(out.env.map((e) => e.key)).toEqual(['A', 'Z'])
    })

    it('reveals the real secret value when canReadSecrets', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [secretRef('DB_PASS', 's1')],
                canReadSecrets: true,
                secretValues: { s1: 'hunter2' },
                secretMeta: { s1: { key: 'DB_PASS_SECRET', updatedAt: T0 } },
            }),
        )
        expect(out.env[0]).toMatchObject({
            key: 'DB_PASS',
            value: 'hunter2',
            source: 'secret_ref',
            masked: false,
        })
    })

    it('masks the secret with a placeholder + masked:true when not authorized', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [secretRef('DB_PASS', 's1')],
                canReadSecrets: false,
                secretMeta: { s1: { key: 'DB_PASS_SECRET', updatedAt: T0 } },
            }),
        )
        expect(out.env[0]).toMatchObject({
            key: 'DB_PASS',
            value: '<hidden:DB_PASS_SECRET>',
            source: 'secret_ref',
            masked: true,
        })
    })

    it('falls back to <hidden:secret> when secret meta is missing', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [secretRef('X', 'unknown')],
                canReadSecrets: false,
                secretMeta: {},
            }),
        )
        expect(out.env[0].value).toBe('<hidden:secret>')
    })

    it('flags missingRequired for an empty required literal', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('NEED', '', { required: true })],
            }),
        )
        expect(out.missingRequired).toEqual(['NEED'])
    })

    it('does not flag a required secret_ref as missing (counts as non-empty)', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [secretRef('NEED', 's1', { required: true })],
                canReadSecrets: false,
                secretMeta: { s1: { key: 'NEED_SECRET', updatedAt: T0 } },
            }),
        )
        expect(out.missingRequired).toEqual([])
    })

    it('does not flag a non-required empty literal', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('OPT', '')],
            }),
        )
        expect(out.missingRequired).toEqual([])
    })

    it('interpolates ${DB_HOST} across literals', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('DB_HOST', 'db.internal'), literal('URL', 'pg://${DB_HOST}/app')],
            }),
        )
        const url = out.env.find((e) => e.key === 'URL')!
        expect(url.value).toBe('pg://db.internal/app')
    })

    it('propagates the masked placeholder through interpolation for a developer (decision #12)', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [secretRef('DBPASS', 's1'), literal('URL', 'pg://user:${DBPASS}@host')],
                canReadSecrets: false,
                secretMeta: { s1: { key: 'DB_PASS_SECRET', updatedAt: T0 } },
            }),
        )
        const url = out.env.find((e) => e.key === 'URL')!
        expect(url.value).toBe('pg://user:<hidden:DB_PASS_SECRET>@host')
    })

    it('marks a key pending when its row updatedAt is newer than lastFetchAt', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('A', 'a', { updatedAt: T2 })],
                lastFetchAt: T1,
            }),
        )
        expect(out.pending).toEqual(['A'])
        expect(out.env[0].pending).toBe(true)
    })

    it('marks a secret_ref pending when the referenced secret changed after lastFetchAt', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [secretRef('S', 's1', { updatedAt: T0 })],
                canReadSecrets: true,
                secretValues: { s1: 'v' },
                secretMeta: { s1: { key: 'S_SECRET', updatedAt: T2 } },
                lastFetchAt: T1,
            }),
        )
        expect(out.pending).toEqual(['S'])
        expect(out.env[0].pending).toBe(true)
    })

    it('does not mark anything pending when never fetched (lastFetchAt undefined)', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('A', 'a', { updatedAt: T2 })],
                lastFetchAt: undefined,
            }),
        )
        expect(out.pending).toEqual([])
        expect(out.env[0].pending).toBeUndefined()
    })

    it('does not mark a key pending when its updatedAt is older than lastFetchAt', () => {
        const out = resolveConfig(
            baseInput({
                baseline: [literal('A', 'a', { updatedAt: T0 })],
                lastFetchAt: T1,
            }),
        )
        expect(out.pending).toEqual([])
    })
})
