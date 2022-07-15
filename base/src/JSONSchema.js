/**
 * @typedef DataType
 * @type {('number'|'string'|'boolean'|'object')}
 */


/**
 * @typedef Schema
 * @property {DataType} type type of the property
 * @property {boolean} required is required
 * @property {Object<string,Schema>} properties validate object properties (works only with type='object')
 * @property {boolean} flexible is object flexible (works only with type='object')
 */

/**
 * @callback ValidationFn
 * @param {string} propertyName
 * @param {Schema} schema
 * @param {any} data
 * @returns {boolean|string}
 */


class JSONSchema {

    /**
     * @private
     * @type {Map<string,ValidationFn>}
     */
    validators = new Map()

    /**
     * @private
     * @type {Schema}
     */
    schema = null

    /**
     * 
     * @param {Schema} schema 
     */
    constructor(schema) {
        this.validateSchema(schema)
        this.schema = schema
        this.register('string', this.validateString)
        this.register('boolean', this.validateBoolean)
        this.register('number', this.validateNumber)
        this.register('object', this.validateObject)
    }

    /**
     * 
     * @param {string} type 
     * @param {ValidationFn} validationFn 
     */
    register(type = null, validationFn = null) {
        
        if (typeof type !== 'string') {
            throw new Error(`validation type must be a string, "${type}" provided`)
        }

        if (this.validators.has(type)) {
            throw new Error(`validation type "${type}" is already registered`)
        }

        if (typeof validationFn !== 'function') {
            throw new Error(`validation function is not a valid function, ${validationFn} provided`)
        }

        this.validators.set(type, validationFn)
    }

    /**
     * 
     * @param {any} data 
     */
    validate(data) {
        let validator = this.validators.get(this.schema.type) || null
        validator(null, this.schema, data)
    }

    /**
     * @private
     * @param {Schema} schema 
     */
    validateSchema(schema) {
        if (typeof schema !== 'object') {
            throw new Error(`schema must be an object, ${schema} provided`)
        }
        if (typeof schema.type !== 'string') {
            throw new Error(`schema type must be a string, ${schema.type} provided`)
        }

        if (typeof schema.properties !== 'object') {
            return
        }

        for (let property in schema.properties) {
            this.validateSchema(schema.properties[property])
        }

    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateString = (propertyName, schema, data) => {
        
        console.log(propertyName, data, schema.required)
        if (typeof data === 'undefined' && schema.required === false) {
            return
        }
        if (typeof data !== 'string') {
            throw new Error(`property=${propertyName} must be a string`)
        }
    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateBoolean = (propertyName, schema, data) => {
        
        if (typeof data === 'undefined' && schema.required === false) {
            return
        }

        if (typeof data !== 'boolean') {
            throw new Error(`property=${propertyName} must be a boolean`)
        }
    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateNumber = (propertyName, schema, data) => {

        if (typeof data === 'undefined' && schema.required === false) {
            return
        }
        if (typeof data !== 'number') {
            throw new Error(`property=${propertyName} must be a number`)
        }

    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateObject = (propertyName, schema, data) => {

        if (typeof data === 'undefined' && schema.required === false) {
            return
        }

        if (typeof data !== 'object') {
            throw new Error(`property=${propertyName} must be an object`)
        }

        let isStrict = schema.flexible !== true

        for ()

        for (let propName in data) {
            let propSchema = typeof schema.properties[propName] === 'object' ? schema.properties[propName] : null
            if (propSchema === null && isStrict) {
                throw new Error(`property ${propName} is not allowed`)
            } else if (propSchema === null) {
                continue
            }
            let validator = this.validators.get(propSchema.type)
            validator(propName, propSchema, data[propName])
        }

    }

}


module.exports = JSONSchema