import { Root, Type, Field, Writer, Namespace } from 'protobufjs/light'
import generateId from './generateId'

/**
 * @typedef FieldType
 * @property {string} key
 * @property {('double'|'float'|'int32'|'uint32'|'sint32'|'fixed32'|'sfixed32'|'int64'|'uint64'|'sint64'|'fixed64'|'sfixed64'|'string'|'bool'|'bytes')} type
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

export default Serializer