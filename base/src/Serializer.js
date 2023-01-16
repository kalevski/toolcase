import { Root, Type, Field, Writer, Namespace } from 'protobufjs/light'
import generateId from './generateId'

/**
 * @typedef FieldType
 * @property {string} key
 * @property {string} type
 * @property {('optional'|'required'|'repeated')} rule
 */

class Serializer {

    /** @private */
    writer = new Writer()

    /**
     * @private
     * @type {Root}
     */
    root = null

    /**
     * @private
     * @type {Namespace}
     */
    namespace = null

    /**
     * @param {string} [id]
     */
    constructor(id = null) {
        if (id === null) {
            id = generateId(16)
        }
        this.root = new Root()
        this.namespace = this.root.define(id)
    }

    /**
     * 
     * @param {string} key 
     * @param {Array<FieldType>} fields 
     */
    define(key, fields = []) {
        let type = new Type(key)
        for (let [index, field] of fields.entries()) {
            type.add(new Field(field.key, index + 1, field.type, field.rule))
        }
        this.namespace.add(type)
    }

    /**
     * @param {string} key
     * @param {Object<string,any>} message
     * @returns {Uint8Array} 
     */
    encode(key, message) {
        this.writer.reset()
        let type = this.getType(key)
        try {
            return type.encode(message, this.writer).finish()
        } catch (error) {
            throw new Error(`encode error: ${error.message}`)
        }
    }


    /**
     * @param {string} key
     * @param {Uint8Array} buffer
     * @returns {Object<string,any>} 
     */
    decode(key, buffer) {
        let type = this.getType(key)
        try {
            return type.decode(buffer)
        } catch (error) {
            throw new Error(`decode error: ${error.message}`)
        }
    }

    /**
     * @private
     * @param {string} schema
     * @returns {Type} 
     */
    getType(key) {
        try {
            return this.namespace.lookupType(key)
        } catch (error) {
            throw new Error(`type key=${key} is not defined`) 
        }
    }
}

Serializer.FieldType = {
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

export default Serializer