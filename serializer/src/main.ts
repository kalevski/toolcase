import { Root, Type, Field, Writer, Namespace, Message } from 'protobufjs/light'

interface FieldType {
    key: string
    type: string
    rule: 'optional' | 'required' | 'repeated'
    default?: any
}

const generateId = (length: number = 16): string => {
    const bytes = new Uint8Array(Math.ceil(length / 2))
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}

class Serializer {

    private writer: Writer = new Writer()

    private root: Root

    private namespace: Namespace

    constructor(id: string | null = null) {
        if (id === null) {
            id = generateId(16)
        }
        this.root = new Root()
        this.namespace = this.root.define(id)
    }

    define(key: string, fields: FieldType[] = []): void {
        const type = new Type(key)
        for (const [index, field] of fields.entries()) {
            const defaultValue = typeof field.default === 'undefined' ? null : field.default
            const fieldObject = new Field(field.key, index + 1, field.type, field.rule, undefined, {
                default: defaultValue
            })
            type.add(fieldObject)
        }
        this.namespace.add(type)
    }

    encode(key: string, message: Record<string, any>): Uint8Array {
        this.writer.reset()
        const type = this.getType(key)
        try {
            return type.encode(message, this.writer).finish()
        } catch (error: any) {
            const validationError = type.verify(message)
            if (validationError === null) {
                throw new Error(`Serializer[${key}] encode error: ${error.message}`)
            } else {
                throw new Error(`Serializer[${key}] encode error: ${validationError}`)
            }
        }
    }

    decode(key: string, buffer: Uint8Array): Message<Record<string, any>> {
        const type = this.getType(key)
        try {
            const object = type.decode(buffer)
            return object
        } catch (error: any) {
            throw new Error(`decode error: ${error.message}`)
        }
    }

    private getType(key: string): Type {
        try {
            return this.namespace.lookupType(key)
        } catch (_error) {
            throw new Error(`type key=${key} is not defined`) 
        }
    }

    static FieldType = {
        DOUBLE:'double',
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
        BYTES: 'bytes'
    }
}

export default Serializer
export { Serializer }
export type { FieldType }
