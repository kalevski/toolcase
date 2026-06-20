import { Root, Type, Field, MapField, Enum, Writer, Namespace, Message } from 'protobufjs/light'

// eslint-disable-next-line no-var
declare var require: ((id: string) => any) | undefined

type EnumMarker = { __kind: 'enum', values: string[] | Record<string, number> }
type MapMarker = { __kind: 'map', keyType: string, valueType: string }
type PackedMarker = { __kind: 'packed', type: string }
type FieldTypeRef = string | EnumMarker | MapMarker | PackedMarker

interface FieldType {
    key: string
    type: FieldTypeRef
    rule: 'optional' | 'required' | 'repeated'
    default?: any
    /**
     * Explicit protobuf field tag (field number). When omitted the tag is
     * derived from the field's array position (`index + 1`).
     *
     * WARNING — positional tags are fragile: inserting, removing, or
     * reordering a field shifts every subsequent tag and silently
     * corrupts existing buffers. When omitting explicit tags, fields
     * must be **append-only** — never insert or remove in the middle.
     *
     * NOTE — protobuf reserves tags 19000–19999 for internal use;
     * `protobufjs` will reject them. Schemas with ≥ 18999 positional
     * fields will hit this range automatically.
     */
    tag?: number
}

interface SafeResult<T> {
    ok: boolean
    value?: T
    error?: Error
}

interface Version {
    major: number
    minor: number
}

interface VersionedFrame<T = Record<string, any>> {
    version: Version
    message: T
}

type MigrationFn = (message: any) => Record<string, any>

const getRandomBytes = (n: number): Uint8Array => {
    const g = globalThis as any
    if (g.crypto?.getRandomValues) return g.crypto.getRandomValues(new Uint8Array(n))
    try { return require?.('node:crypto').randomBytes(n) } catch { /* fall through */ }
    const b = new Uint8Array(n)
    for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256)
    return b
}

const generateId = (length: number = 16): string => {
    const bytes = getRandomBytes(Math.ceil(length / 2))
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}

const isEnumMarker = (value: any): value is EnumMarker =>
    value !== null && typeof value === 'object' && value.__kind === 'enum'

const isMapMarker = (value: any): value is MapMarker =>
    value !== null && typeof value === 'object' && value.__kind === 'map'

const isPackedMarker = (value: any): value is PackedMarker =>
    value !== null && typeof value === 'object' && value.__kind === 'packed'

const buildEnumValues = (values: string[] | Record<string, number>): Record<string, number> => {
    if (Array.isArray(values)) {
        const out: Record<string, number> = {}
        for (let i = 0; i < values.length; i++) {
            out[values[i]] = i
        }
        return out
    }
    return values
}

class Serializer {

    private writer: Writer = new Writer()

    private root: Root

    private namespace: Namespace

    private currentVersion: Version = { major: 1, minor: 0 }

    private migrations: Map<string, MigrationFn> = new Map()

    private versionedTypes: Map<string, Type> = new Map()

    constructor(id: string | null = null) {
        if (id === null) {
            id = generateId(16)
        }
        this.root = new Root()
        this.namespace = this.root.define(id)
    }

    private buildTypeInNamespace(namespace: Namespace, key: string, fields: FieldType[]): Type {
        const type = new Type(key)
        for (const [index, field] of fields.entries()) {
            const tag = typeof field.tag === 'number' ? field.tag : index + 1
            const defaultValue = typeof field.default === 'undefined' ? null : field.default
            const fieldRef = field.type

            if (isEnumMarker(fieldRef)) {
                const enumName = `${key}_${field.key}_E`
                if (namespace.get(enumName) === null) {
                    namespace.add(new Enum(enumName, buildEnumValues(fieldRef.values)))
                }
                type.add(new Field(field.key, tag, enumName, field.rule, undefined, {
                    default: defaultValue
                }))
                continue
            }

            if (isMapMarker(fieldRef)) {
                type.add(new MapField(field.key, tag, fieldRef.keyType, fieldRef.valueType))
                continue
            }

            if (isPackedMarker(fieldRef)) {
                type.add(new Field(field.key, tag, fieldRef.type, 'repeated', undefined, {
                    default: defaultValue,
                    packed: true
                }))
                continue
            }

            type.add(new Field(field.key, tag, fieldRef as string, field.rule, undefined, {
                default: defaultValue
            }))
        }
        return type
    }

    define(key: string, fields: FieldType[] = []): void {
        if (this.namespace.get(key) !== null) {
            throw new Error(`Serializer: type key=${key} already defined`)
        }
        const type = this.buildTypeInNamespace(this.namespace, key, fields)
        this.namespace.add(type)
    }

    /**
     * Register the schema that was active for `key` at `forMajor`. When
     * `decodeVersioned` encounters a frame with that major version it decodes
     * the body with this schema before running migrations, allowing genuinely
     * breaking changes (field reorder, retype, removal) to be handled safely.
     */
    defineVersion(key: string, forMajor: number, fields: FieldType[]): void {
        if (!Number.isInteger(forMajor) || forMajor < 0 || forMajor > 255) {
            throw new Error(`Serializer.defineVersion: forMajor must be an integer in [0,255], got ${forMajor}`)
        }
        const vRoot = new Root()
        const vNamespace = vRoot.define(`__v${forMajor}_${key}`)
        const type = this.buildTypeInNamespace(vNamespace, key, fields)
        vNamespace.add(type)
        this.versionedTypes.set(`${key}:${forMajor}`, type)
    }

    enum(name: string, values: string[] | Record<string, number>): void {
        if (this.namespace.get(name) !== null) {
            throw new Error(`Serializer: enum name=${name} already defined`)
        }
        this.namespace.add(new Enum(name, buildEnumValues(values)))
    }

    validate(key: string, message: Record<string, any>): string | null {
        const type = this.getType(key)
        return type.verify(message)
    }

    encode(key: string, message: Record<string, any>): Uint8Array {
        this.writer.reset()
        const type = this.getType(key)
        try {
            return type.encode(message, this.writer).finish()
        } catch (error: any) {
            const validationError = type.verify(message)
            const reason = validationError ?? error.message
            throw new Error(`Serializer.encode[${key}] failed: ${reason}`)
        }
    }

    decode(key: string, buffer: Uint8Array): Message<Record<string, any>> {
        const type = this.getType(key)
        try {
            return type.decode(buffer)
        } catch (error: any) {
            const offset = typeof error?.offset === 'number' ? `, offset=${error.offset}` : ''
            const size = buffer?.byteLength ?? '?'
            throw new Error(`Serializer.decode[${key}] failed: ${error.message} (bytes=${size}${offset})`)
        }
    }

    safeEncode(key: string, message: Record<string, any>): SafeResult<Uint8Array> {
        try {
            return { ok: true, value: this.encode(key, message) }
        } catch (error: any) {
            return { ok: false, error }
        }
    }

    safeDecode(key: string, buffer: Uint8Array): SafeResult<Message<Record<string, any>>> {
        try {
            return { ok: true, value: this.decode(key, buffer) }
        } catch (error: any) {
            return { ok: false, error }
        }
    }

    version(major: number, minor: number = 0): void {
        if (!Number.isInteger(major) || major < 0 || major > 255) {
            throw new Error(`Serializer.version: major must be an integer in [0,255], got ${major}`)
        }
        if (!Number.isInteger(minor) || minor < 0 || minor > 255) {
            throw new Error(`Serializer.version: minor must be an integer in [0,255], got ${minor}`)
        }
        this.currentVersion = { major, minor }
    }

    getVersion(): Version {
        return { major: this.currentVersion.major, minor: this.currentVersion.minor }
    }

    migrate(key: string, fromMajor: number, handler: MigrationFn): void {
        if (!Number.isInteger(fromMajor) || fromMajor < 0 || fromMajor > 255) {
            throw new Error(`Serializer.migrate: fromMajor must be an integer in [0,255], got ${fromMajor}`)
        }
        if (typeof handler !== 'function') {
            throw new Error('Serializer.migrate: handler must be a function')
        }
        this.migrations.set(`${key}:${fromMajor}`, handler)
    }

    encodeVersioned(key: string, message: Record<string, any>): Uint8Array {
        const body = this.encode(key, message)
        const out = new Uint8Array(body.byteLength + 2)
        out[0] = this.currentVersion.major
        out[1] = this.currentVersion.minor
        out.set(body, 2)
        return out
    }

    decodeVersioned(key: string, buffer: Uint8Array): VersionedFrame {
        if (!buffer || buffer.byteLength < 2) {
            const size = buffer?.byteLength ?? '?'
            throw new Error(`Serializer.decodeVersioned[${key}] failed: buffer too small for version header (bytes=${size})`)
        }
        const major = buffer[0]
        const minor = buffer[1]
        if (major > this.currentVersion.major) {
            throw new Error(`Serializer.decodeVersioned[${key}] failed: frame v${major}.${minor} is newer than current v${this.currentVersion.major}.${this.currentVersion.minor}`)
        }
        const body = buffer.subarray(2)
        const decodeType = this.versionedTypes.get(`${key}:${major}`) ?? this.getType(key)
        let message: any
        try {
            message = decodeType.decode(body)
        } catch (error: any) {
            const offset = typeof error?.offset === 'number' ? `, offset=${error.offset}` : ''
            const size = body?.byteLength ?? '?'
            throw new Error(`Serializer.decodeVersioned[${key}] failed: ${error.message} (bytes=${size}${offset})`)
        }
        let v = major
        while (v < this.currentVersion.major) {
            const handler = this.migrations.get(`${key}:${v}`)
            if (typeof handler !== 'function') {
                throw new Error(`Serializer.decodeVersioned[${key}] failed: no migration registered for v${v} -> v${v + 1}`)
            }
            message = handler(message)
            v++
        }
        return { version: { major, minor }, message }
    }

    types(): string[] {
        const out: string[] = []
        for (const item of this.namespace.nestedArray) {
            if (item instanceof Type) out.push(item.name)
        }
        return out
    }

    fields(key: string): FieldType[] {
        const type = this.getType(key)
        return type.fieldsArray.map(f => {
            if (f instanceof MapField) {
                return {
                    key: f.name,
                    type: Serializer.FieldType.MAP(f.keyType, f.type),
                    rule: 'optional' as FieldType['rule'],
                    tag: f.id
                }
            }
            const enumDef = this.namespace.get(f.type)
            if (enumDef instanceof Enum) {
                return {
                    key: f.name,
                    type: Serializer.FieldType.ENUM(enumDef.values as Record<string, number>),
                    rule: (f.repeated ? 'repeated' : f.required ? 'required' : 'optional') as FieldType['rule'],
                    default: f.options?.default,
                    tag: f.id
                }
            }
            if (f.repeated && f.options?.packed === true) {
                return {
                    key: f.name,
                    type: Serializer.FieldType.PACKED_ARRAY(f.type),
                    rule: 'repeated' as FieldType['rule'],
                    tag: f.id
                }
            }
            return {
                key: f.name,
                type: f.type,
                rule: (f.repeated ? 'repeated' : f.required ? 'required' : 'optional') as FieldType['rule'],
                default: f.options?.default,
                tag: f.id
            }
        })
    }

    fragment(buffer: Uint8Array, maxChunkSize: number = 16384): Uint8Array[] {
        if (!Number.isInteger(maxChunkSize) || maxChunkSize < 1) {
            throw new Error(`Serializer.fragment: maxChunkSize must be a positive integer, got ${maxChunkSize}`)
        }
        const length = buffer.byteLength
        const total = Math.max(1, Math.ceil(length / maxChunkSize))
        if (total > 0xffff) {
            throw new Error(`Serializer.fragment: ${total} chunks exceeds the 65535 limit; raise maxChunkSize`)
        }
        const frameId = Math.floor(Math.random() * 0xffffffff) >>> 0
        const out: Uint8Array[] = []
        for (let i = 0; i < total; i++) {
            const start = i * maxChunkSize
            const end = Math.min(start + maxChunkSize, length)
            const slice = buffer.subarray(start, end)
            const chunk = new Uint8Array(8 + slice.byteLength)
            chunk[0] = (frameId >>> 24) & 0xff
            chunk[1] = (frameId >>> 16) & 0xff
            chunk[2] = (frameId >>> 8) & 0xff
            chunk[3] = frameId & 0xff
            chunk[4] = (i >>> 8) & 0xff
            chunk[5] = i & 0xff
            chunk[6] = (total >>> 8) & 0xff
            chunk[7] = total & 0xff
            chunk.set(slice, 8)
            out.push(chunk)
        }
        return out
    }

    reassemble(chunks: Uint8Array[]): Uint8Array {
        if (!Array.isArray(chunks) || chunks.length === 0) {
            throw new Error('Serializer.reassemble: chunks must be a non-empty array')
        }
        const first = chunks[0]
        if (!first || first.byteLength < 8) {
            throw new Error('Serializer.reassemble: chunk header truncated (need 8 bytes)')
        }
        const frameId = (((first[0] << 24) | (first[1] << 16) | (first[2] << 8) | first[3]) >>> 0)
        const total = (first[6] << 8) | first[7]
        if (chunks.length !== total) {
            throw new Error(`Serializer.reassemble: chunk count mismatch — got ${chunks.length}, header says ${total}`)
        }
        const ordered: Uint8Array[] = new Array(total)
        let payloadBytes = 0
        for (const chunk of chunks) {
            if (!chunk || chunk.byteLength < 8) {
                throw new Error('Serializer.reassemble: chunk header truncated (need 8 bytes)')
            }
            const fid = (((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0)
            if (fid !== frameId) {
                throw new Error(`Serializer.reassemble: frameId mismatch — chunks belong to different frames`)
            }
            const index = (chunk[4] << 8) | chunk[5]
            const t = (chunk[6] << 8) | chunk[7]
            if (t !== total) {
                throw new Error(`Serializer.reassemble: total mismatch — chunk says ${t}, expected ${total}`)
            }
            if (index < 0 || index >= total) {
                throw new Error(`Serializer.reassemble: index ${index} out of range [0, ${total})`)
            }
            if (ordered[index] !== undefined) {
                throw new Error(`Serializer.reassemble: duplicate chunk at index ${index}`)
            }
            const payload = chunk.subarray(8)
            ordered[index] = payload
            payloadBytes += payload.byteLength
        }
        const out = new Uint8Array(payloadBytes)
        let offset = 0
        for (const part of ordered) {
            out.set(part, offset)
            offset += part.byteLength
        }
        return out
    }

    private getType(key: string): Type {
        try {
            return this.namespace.lookupType(key)
        } catch (_error) {
            const known = this.types()
            const hint = known.length > 0 ? ` known types: [${known.join(', ')}]` : ' no types defined'
            throw new Error(`Serializer: type key=${key} is not defined.${hint}`)
        }
    }

    static FieldType = {
        DOUBLE: 'double',
        FLOAT: 'float',
        INT32: 'int32',
        UINT32: 'uint32',
        SINT32: 'sint32',
        FIXED32: 'fixed32',
        SFIXED32: 'sfixed32',
        INT64: 'int64',
        UINT64: 'uint64',
        SINT64: 'sint64',
        FIXED64: 'fixed64',
        SFIXED64: 'sfixed64',
        STRING: 'string',
        BOOL: 'bool',
        BYTES: 'bytes',
        ENUM: (values: string[] | Record<string, number>): EnumMarker => ({ __kind: 'enum', values }),
        MAP: (keyType: string, valueType: string): MapMarker => ({ __kind: 'map', keyType, valueType }),
        PACKED_ARRAY: (type: string): PackedMarker => ({ __kind: 'packed', type })
    }
}

export default Serializer
export { Serializer }
export type { FieldType, SafeResult, EnumMarker, MapMarker, PackedMarker, FieldTypeRef, Version, VersionedFrame, MigrationFn }
