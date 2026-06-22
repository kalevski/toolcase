import { describe, it, expect, beforeEach } from 'vitest'
import SaveService from '../src/persistence/SaveService'
import MemoryBackend from '../src/persistence/MemoryBackend'

function makeService(namespace = 'test', schema = { version: 1 }) {
    return new SaveService({ backend: new MemoryBackend(), namespace, schema })
}

describe('SaveService', () => {
    let service: SaveService

    beforeEach(() => {
        service = makeService()
    })

    describe('save / load', () => {
        it('round-trips plain data', async () => {
            await service.save('slot-1', { score: 100, level: 3 })
            const data = await service.load('slot-1')
            expect(data).toEqual({ score: 100, level: 3 })
        })

        it('returns null for a missing slot', async () => {
            expect(await service.load('missing')).toBeNull()
        })

        it('overwrites an existing slot', async () => {
            await service.save('slot-1', { score: 10 })
            await service.save('slot-1', { score: 99 })
            expect((await service.load<{ score: number }>('slot-1'))?.score).toBe(99)
        })
    })

    describe('delete', () => {
        it('removes a saved slot', async () => {
            await service.save('slot-1', { score: 1 })
            await service.delete('slot-1')
            expect(await service.load('slot-1')).toBeNull()
        })

        it('does not throw when slot does not exist', async () => {
            await expect(service.delete('ghost')).resolves.toBeUndefined()
        })
    })

    describe('has', () => {
        it('returns true for a saved slot', async () => {
            await service.save('s', {})
            expect(await service.has('s')).toBe(true)
        })

        it('returns false for a missing slot', async () => {
            expect(await service.has('nope')).toBe(false)
        })
    })

    describe('list', () => {
        it('returns all saved entries', async () => {
            await service.save('slot-1', {})
            await service.save('slot-2', {})
            const entries = await service.list()
            expect(entries.map(e => e.id).sort()).toEqual(['slot-1', 'slot-2'])
        })

        it('does not return entries from a different namespace', async () => {
            const other = makeService('other')
            await other.save('slot-1', {})
            const entries = await service.list()
            expect(entries).toHaveLength(0)
        })

        it('includes savedAt and version in each entry', async () => {
            await service.save('slot-1', {})
            const [entry] = await service.list()
            expect(entry.version).toBe(1)
            expect(typeof entry.savedAt).toBe('number')
            expect(entry.savedAt).toBeGreaterThan(0)
        })
    })

    describe('migration', () => {
        it('applies a single migration step', async () => {
            const backend = new MemoryBackend()

            const v1 = new SaveService({
                backend,
                namespace: 'mg',
                schema: { version: 1 }
            })
            await v1.save('s', { score: 42 })

            const v2 = new SaveService({
                backend,
                namespace: 'mg',
                schema: {
                    version: 2,
                    migrations: {
                        1: (d: unknown) => ({ ...(d as object), playerName: 'Hero' })
                    }
                }
            })
            const loaded = await v2.load<{ score: number, playerName: string }>('s')
            expect(loaded?.score).toBe(42)
            expect(loaded?.playerName).toBe('Hero')
        })

        it('chains v1→v2→v3 migrations', async () => {
            const backend = new MemoryBackend()

            const v1 = new SaveService({ backend, namespace: 'chain', schema: { version: 1 } })
            await v1.save('s', { a: 1 })

            const v3 = new SaveService({
                backend,
                namespace: 'chain',
                schema: {
                    version: 3,
                    migrations: {
                        1: (d: unknown) => ({ ...(d as object), b: 2 }),
                        2: (d: unknown) => ({ ...(d as object), c: 3 })
                    }
                }
            })
            const loaded = await v3.load<{ a: number, b: number, c: number }>('s')
            expect(loaded).toEqual({ a: 1, b: 2, c: 3 })
        })

        it('returns data unchanged when schema versions match', async () => {
            const v2 = new SaveService({
                backend: new MemoryBackend(),
                namespace: 'same',
                schema: { version: 2, migrations: { 1: () => ({ injected: true }) } }
            })
            await v2.save('s', { score: 7 })
            const loaded = await v2.load<{ score: number }>('s')
            expect(loaded?.score).toBe(7)
            expect((loaded as any).injected).toBeUndefined()
        })
    })

    describe('setSchema', () => {
        it('updates schema in place', async () => {
            const backend = new MemoryBackend()
            const svc = new SaveService({ backend, namespace: 'upd', schema: { version: 1 } })
            await svc.save('s', { x: 1 })

            svc.setSchema({
                version: 2,
                migrations: { 1: (d: unknown) => ({ ...(d as object), y: 2 }) }
            })
            const loaded = await svc.load<{ x: number, y: number }>('s')
            expect(loaded?.y).toBe(2)
        })
    })
})
