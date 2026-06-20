import { describe, it, expect } from 'vitest'
import Serializer from '../src/main'

const F = Serializer.FieldType

const buildPlayer = () => {
    const s = new Serializer('PlayerNS')
    s.define('Player', [
        { key: 'id', type: F.STRING, rule: 'required' },
        { key: 'level', type: F.INT32, rule: 'optional', default: 1 },
        { key: 'tags', type: F.STRING, rule: 'repeated' },
        { key: 'alive', type: F.BOOL, rule: 'optional', default: true }
    ])
    return s
}

describe('Serializer.encode/decode roundtrip', () => {
    it('roundtrips a basic message', () => {
        const s = buildPlayer()
        const buf = s.encode('Player', { id: 'p1', level: 7, tags: ['hero', 'mage'], alive: true })
        const out = s.decode('Player', buf)
        expect(out.id).toBe('p1')
        expect(out.level).toBe(7)
        expect(out.tags).toEqual(['hero', 'mage'])
        expect(out.alive).toBe(true)
    })

    it('roundtrips an empty repeated field', () => {
        const s = buildPlayer()
        const buf = s.encode('Player', { id: 'p2', tags: [] })
        const out = s.decode('Player', buf)
        expect(out.id).toBe('p2')
        expect(out.tags).toEqual([])
    })

    it('roundtrips bytes', () => {
        const s = new Serializer()
        s.define('Blob', [{ key: 'data', type: F.BYTES, rule: 'required' }])
        const payload = new Uint8Array([0, 1, 2, 3, 255])
        const buf = s.encode('Blob', { data: payload })
        const out = s.decode('Blob', buf)
        expect(Array.from(out.data)).toEqual([0, 1, 2, 3, 255])
    })

    it('roundtrips numeric scalars', () => {
        const s = new Serializer()
        s.define('Vec', [
            { key: 'x', type: F.FLOAT, rule: 'optional' },
            { key: 'y', type: F.DOUBLE, rule: 'optional' },
            { key: 'z', type: F.SINT32, rule: 'optional' }
        ])
        const buf = s.encode('Vec', { x: 1.5, y: -2.25, z: -42 })
        const out = s.decode('Vec', buf)
        expect(out.x).toBeCloseTo(1.5)
        expect(out.y).toBeCloseTo(-2.25)
        expect(out.z).toBe(-42)
    })
})

describe('Serializer.encode error paths', () => {
    it('throws when type key is unknown', () => {
        const s = buildPlayer()
        expect(() => s.encode('Ghost', {})).toThrow(/type key=Ghost is not defined/)
    })

    it('lists known types in unknown-type error', () => {
        const s = buildPlayer()
        try {
            s.encode('Ghost', {})
            expect.unreachable()
        } catch (e: any) {
            expect(e.message).toContain('Player')
        }
    })

    it('validate() reports field-level reason for bad payload', () => {
        const s = buildPlayer()
        expect(s.validate('Player', { id: 123 } as any)).toMatch(/id/)
        expect(s.validate('Player', { id: 'p', tags: 42 } as any)).toMatch(/array expected/)
    })
})

describe('Serializer.decode error paths', () => {
    it('throws with key + buffer size in message', () => {
        const s = buildPlayer()
        const garbage = new Uint8Array([0xff, 0xff, 0xff])
        try {
            s.decode('Player', garbage)
            expect.unreachable()
        } catch (e: any) {
            expect(e.message).toContain('Player')
            expect(e.message).toContain('bytes=3')
        }
    })

    it('throws with helpful unknown-type message', () => {
        const s = buildPlayer()
        const buf = new Uint8Array([])
        expect(() => s.decode('Nope', buf)).toThrow(/type key=Nope/)
    })
})

describe('Serializer.validate', () => {
    it('returns null for a valid message', () => {
        const s = buildPlayer()
        expect(s.validate('Player', { id: 'p', level: 1 })).toBeNull()
    })

    it('returns string when message is invalid', () => {
        const s = buildPlayer()
        const result = s.validate('Player', { id: 99 } as any)
        expect(typeof result).toBe('string')
    })
})

describe('Serializer.safeEncode / safeDecode', () => {
    it('safeEncode returns ok envelope on success', () => {
        const s = buildPlayer()
        const r = s.safeEncode('Player', { id: 'a' })
        expect(r.ok).toBe(true)
        expect(r.value).toBeInstanceOf(Uint8Array)
        expect(r.error).toBeUndefined()
    })

    it('safeEncode returns error envelope when type is unknown', () => {
        const s = buildPlayer()
        const r = s.safeEncode('Ghost', { id: 'p' })
        expect(r.ok).toBe(false)
        expect(r.error).toBeInstanceOf(Error)
        expect(r.error?.message).toMatch(/type key=Ghost/)
        expect(r.value).toBeUndefined()
    })

    it('safeDecode returns ok envelope on roundtrip', () => {
        const s = buildPlayer()
        const buf = s.encode('Player', { id: 'a' })
        const r = s.safeDecode('Player', buf)
        expect(r.ok).toBe(true)
        expect(r.value?.id).toBe('a')
    })

    it('safeDecode returns error envelope on garbage', () => {
        const s = buildPlayer()
        const r = s.safeDecode('Player', new Uint8Array([0xff, 0xff]))
        expect(r.ok).toBe(false)
        expect(r.error).toBeInstanceOf(Error)
    })
})

describe('Serializer introspection', () => {
    it('types() lists every defined type', () => {
        const s = new Serializer()
        s.define('A', [{ key: 'x', type: F.INT32, rule: 'optional' }])
        s.define('B', [{ key: 'y', type: F.STRING, rule: 'optional' }])
        expect(s.types().sort()).toEqual(['A', 'B'])
    })

    it('fields() reports field metadata', () => {
        const s = buildPlayer()
        const fields = s.fields('Player')
        const byKey = Object.fromEntries(fields.map(f => [f.key, f]))
        expect(byKey.id.type).toBe('string')
        expect(byKey.tags.rule).toBe('repeated')
        expect(byKey.level.default).toBe(1)
        expect(byKey.alive.type).toBe('bool')
    })

    it('fields() throws for unknown type', () => {
        const s = buildPlayer()
        expect(() => s.fields('Ghost')).toThrow(/type key=Ghost/)
    })
})

describe('Serializer FieldType constants', () => {
    it('exposes all 15 scalar types', () => {
        const expected = [
            'DOUBLE','FLOAT','INT32','UINT32','SINT32','FIXED32','SFIXED32',
            'INT64','UINT64','SINT64','FIXED64','SFIXED64','STRING','BOOL','BYTES'
        ]
        for (const k of expected) {
            expect((F as any)[k]).toBeTypeOf('string')
        }
    })

    it('exposes ENUM/MAP/PACKED_ARRAY helpers', () => {
        expect(typeof F.ENUM).toBe('function')
        expect(typeof F.MAP).toBe('function')
        expect(typeof F.PACKED_ARRAY).toBe('function')
    })
})

describe('Serializer ENUM', () => {
    it('roundtrips an enum field defined inline (string[])', () => {
        const s = new Serializer()
        s.define('Person', [
            { key: 'name', type: F.STRING, rule: 'required' },
            { key: 'role', type: F.ENUM(['admin', 'user', 'guest']), rule: 'optional', default: 1 }
        ])
        const buf = s.encode('Person', { name: 'A', role: 0 })
        const out = s.decode('Person', buf) as any
        expect(out.name).toBe('A')
        expect(out.role).toBe(0)
    })

    it('honors enum default on decode when omitted', () => {
        const s = new Serializer()
        s.define('Person', [
            { key: 'role', type: F.ENUM(['admin', 'user', 'guest']), rule: 'optional', default: 2 }
        ])
        const buf = s.encode('Person', {})
        const out = s.decode('Person', buf) as any
        expect(out.role).toBe(2)
    })

    it('accepts explicit Record<string, number> values', () => {
        const s = new Serializer()
        s.define('M', [
            { key: 'k', type: F.ENUM({ FOO: 10, BAR: 20 }), rule: 'optional', default: 10 }
        ])
        const buf = s.encode('M', { k: 20 })
        const out = s.decode('M', buf) as any
        expect(out.k).toBe(20)
    })

    it('top-level enum() registers a reusable enum', () => {
        const s = new Serializer()
        s.enum('Role', ['admin', 'user'])
        s.define('A', [{ key: 'r', type: 'Role', rule: 'optional' }])
        const buf = s.encode('A', { r: 1 })
        const out = s.decode('A', buf) as any
        expect(out.r).toBe(1)
    })

    it('top-level enum() rejects duplicate names', () => {
        const s = new Serializer()
        s.enum('Role', ['a'])
        expect(() => s.enum('Role', ['b'])).toThrow(/already defined/)
    })
})

describe('Serializer MAP', () => {
    it('roundtrips a map<string,int32>', () => {
        const s = new Serializer()
        s.define('Stats', [
            { key: 'counts', type: F.MAP(F.STRING, F.INT32), rule: 'optional' }
        ])
        const buf = s.encode('Stats', { counts: { kills: 7, deaths: 2 } })
        const out = s.decode('Stats', buf) as any
        expect(out.counts).toEqual({ kills: 7, deaths: 2 })
    })

    it('roundtrips an empty map', () => {
        const s = new Serializer()
        s.define('Stats', [
            { key: 'counts', type: F.MAP(F.STRING, F.INT32), rule: 'optional' }
        ])
        const buf = s.encode('Stats', { counts: {} })
        const out = s.decode('Stats', buf) as any
        expect(out.counts).toEqual({})
    })
})

describe('Serializer PACKED_ARRAY', () => {
    it('roundtrips a packed repeated scalar', () => {
        const s = new Serializer()
        s.define('Frame', [
            { key: 'ticks', type: F.PACKED_ARRAY(F.UINT32), rule: 'repeated' }
        ])
        const buf = s.encode('Frame', { ticks: [1, 2, 3, 4, 5] })
        const out = s.decode('Frame', buf) as any
        expect(Array.from(out.ticks)).toEqual([1, 2, 3, 4, 5])
    })
})

describe('Serializer versioning', () => {
    it('default version is 1.0', () => {
        const s = new Serializer()
        expect(s.getVersion()).toEqual({ major: 1, minor: 0 })
    })

    it('version() updates current version', () => {
        const s = new Serializer()
        s.version(3, 7)
        expect(s.getVersion()).toEqual({ major: 3, minor: 7 })
    })

    it('rejects out-of-range version components', () => {
        const s = new Serializer()
        expect(() => s.version(-1)).toThrow(/major must be an integer/)
        expect(() => s.version(256)).toThrow(/major must be an integer/)
        expect(() => s.version(1, -1)).toThrow(/minor must be an integer/)
        expect(() => s.version(1, 256)).toThrow(/minor must be an integer/)
    })

    it('encodeVersioned + decodeVersioned roundtrips at same version', () => {
        const s = new Serializer()
        s.version(2, 5)
        s.define('Player', [{ key: 'name', type: F.STRING, rule: 'required' }])
        const frame = s.encodeVersioned('Player', { name: 'Alice' })
        const out = s.decodeVersioned('Player', frame)
        expect(out.version).toEqual({ major: 2, minor: 5 })
        expect((out.message as any).name).toBe('Alice')
    })

    it('migrate handler runs when frame is older than current major', () => {
        const v1 = new Serializer()
        v1.version(1, 0)
        v1.define('Player', [{ key: 'name', type: F.STRING, rule: 'required' }])
        const oldFrame = v1.encodeVersioned('Player', { name: 'Alice' })

        const v2 = new Serializer()
        v2.version(2, 0)
        v2.define('Player', [
            { key: 'name', type: F.STRING, rule: 'required' },
            { key: 'level', type: F.INT32, rule: 'optional', default: 1 }
        ])
        v2.migrate('Player', 1, msg => ({ name: msg.name, level: 1 }))

        const out = v2.decodeVersioned('Player', oldFrame)
        expect(out.version).toEqual({ major: 1, minor: 0 })
        expect((out.message as any).name).toBe('Alice')
        expect((out.message as any).level).toBe(1)
    })

    it('migrations chain across multiple versions', () => {
        const v3 = new Serializer()
        v3.version(3, 0)
        v3.define('Doc', [{ key: 'text', type: F.STRING, rule: 'required' }])
        v3.migrate('Doc', 1, msg => ({ ...msg, _step: 'v1->v2' }))
        v3.migrate('Doc', 2, msg => ({ ...msg, _step: msg._step + ',v2->v3' }))

        // craft v1 frame with same Doc shape
        const v1 = new Serializer()
        v1.version(1, 0)
        v1.define('Doc', [{ key: 'text', type: F.STRING, rule: 'required' }])
        const frame = v1.encodeVersioned('Doc', { text: 'hi' })

        const out = v3.decodeVersioned('Doc', frame)
        expect((out.message as any)._step).toBe('v1->v2,v2->v3')
    })

    it('rejects frames with major newer than current', () => {
        const future = new Serializer()
        future.version(5, 0)
        future.define('X', [{ key: 'k', type: F.STRING, rule: 'required' }])
        const futureFrame = future.encodeVersioned('X', { k: 'hi' })

        const old = new Serializer()
        old.version(2, 0)
        old.define('X', [{ key: 'k', type: F.STRING, rule: 'required' }])
        expect(() => old.decodeVersioned('X', futureFrame)).toThrow(/newer than current/)
    })

    it('rejects when no migration is registered for the gap', () => {
        const v2 = new Serializer()
        v2.version(2, 0)
        v2.define('Y', [{ key: 'a', type: F.STRING, rule: 'required' }])

        const v1 = new Serializer()
        v1.version(1, 0)
        v1.define('Y', [{ key: 'a', type: F.STRING, rule: 'required' }])
        const frame = v1.encodeVersioned('Y', { a: 'x' })

        expect(() => v2.decodeVersioned('Y', frame)).toThrow(/no migration registered for v1 -> v2/)
    })

    it('decodeVersioned errors on truncated buffer', () => {
        const s = new Serializer()
        s.define('Z', [{ key: 'a', type: F.STRING, rule: 'required' }])
        expect(() => s.decodeVersioned('Z', new Uint8Array([1]))).toThrow(/buffer too small/)
    })
})

describe('Serializer default constructor — Node 18 crypto compatibility', () => {
    it('constructs and produces a non-empty id when globalThis.crypto is absent', () => {
        const savedCrypto = (globalThis as any).crypto
        try {
            (globalThis as any).crypto = undefined
            const s = new Serializer()
            const id: string = (s as any).namespace.name
            expect(id).toBeTruthy()
            expect(id.length).toBeGreaterThan(0)
        } finally {
            (globalThis as any).crypto = savedCrypto
        }
    })
})

describe('Serializer fragment / reassemble', () => {
    it('roundtrips a small payload (single chunk)', () => {
        const s = new Serializer()
        const payload = new Uint8Array([1, 2, 3, 4, 5])
        const chunks = s.fragment(payload, 1024)
        expect(chunks).toHaveLength(1)
        const out = s.reassemble(chunks)
        expect(Array.from(out)).toEqual([1, 2, 3, 4, 5])
    })

    it('roundtrips a multi-chunk payload', () => {
        const s = new Serializer()
        const payload = new Uint8Array(10000)
        for (let i = 0; i < payload.length; i++) payload[i] = i & 0xff
        const chunks = s.fragment(payload, 1024)
        expect(chunks.length).toBeGreaterThan(1)
        const out = s.reassemble(chunks)
        expect(out.byteLength).toBe(10000)
        for (let i = 0; i < out.length; i++) {
            if (out[i] !== (i & 0xff)) throw new Error(`mismatch at ${i}`)
        }
    })

    it('reassemble accepts chunks in any order', () => {
        const s = new Serializer()
        const payload = new Uint8Array(3000)
        for (let i = 0; i < payload.length; i++) payload[i] = i & 0xff
        const chunks = s.fragment(payload, 500)
        const shuffled = [...chunks].reverse()
        const out = s.reassemble(shuffled)
        for (let i = 0; i < out.length; i++) {
            if (out[i] !== (i & 0xff)) throw new Error(`mismatch at ${i}`)
        }
    })

    it('reassemble rejects mixed frames (frameId mismatch)', () => {
        const s = new Serializer()
        const aChunks = s.fragment(new Uint8Array(2000), 500)
        const bChunks = s.fragment(new Uint8Array(2000), 500)
        const mixed = [aChunks[0], bChunks[1], aChunks[2], aChunks[3]]
        expect(() => s.reassemble(mixed)).toThrow(/frameId mismatch/)
    })

    it('reassemble rejects missing chunks', () => {
        const s = new Serializer()
        const chunks = s.fragment(new Uint8Array(2000), 500)
        const dropped = chunks.slice(0, chunks.length - 1)
        expect(() => s.reassemble(dropped)).toThrow(/chunk count mismatch/)
    })

    it('reassemble rejects duplicate index', () => {
        const s = new Serializer()
        const chunks = s.fragment(new Uint8Array(2000), 500)
        const dup = [chunks[0], chunks[1], chunks[1], chunks[3]]
        expect(() => s.reassemble(dup)).toThrow(/duplicate chunk/)
    })

    it('fragment validates maxChunkSize', () => {
        const s = new Serializer()
        expect(() => s.fragment(new Uint8Array(10), 0)).toThrow(/positive integer/)
    })
})
