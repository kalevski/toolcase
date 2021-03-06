/**
 * @typedef DataType
 * @type {('number'|'string'|'boolean'|'object'|'array'|'email')}
 */


/**
 * @typedef Schema
 * @property {DataType} type type of the property
 * @property {boolean} required is required
 * @property {Object<string,Schema>} properties validate object properties (works only with type='object')
 * @property {boolean} flexible is object flexible (works only with type='object')
 * @property {Schema} items type of the properties (works only with type='array')
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
        this.register('string', this.validateString)
        this.register('boolean', this.validateBoolean)
        this.register('number', this.validateNumber)
        this.register('object', this.validateObject)
        this.register('array', this.validateArray)

        this.register('email', this.validateEmail)
        
        this.validateSchema(schema)
        this.schema = schema
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
            throw new Error(`schema must be an object, "${schema}" provided`)
        }

        if (typeof schema.type !== 'string') {
            throw new Error(`schema type must be a string, "${schema.type}" provided`)
        }

        if (typeof schema.properties !== 'object') {
            return
        }

        if (!this.validators.has(schema.type)) {
            throw new Error(`schama type does not exist, "${schema.type}" provided`)
        }

        if (schema.type === 'array' && typeof schema.items === 'object') {
            this.validateSchema(schema.items)
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

        if (typeof data !== 'string') {
            throw new Error(`property "${propertyName}" must be a string, "${data}" provided`)
        }
    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateBoolean = (propertyName, schema, data) => {

        if (typeof data !== 'boolean') {
            throw new Error(`property "${propertyName}" can be "true" or "false", "${data}" provided`)
        }
    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateNumber = (propertyName, schema, data) => {

        if (typeof data !== 'number') {
            throw new Error(`property "${propertyName}" must be a number, "${data}" provided`)
        }

    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateObject = (propertyName, schema, data) => {


        if (typeof data !== 'object') {
            throw new Error(`property "${propertyName}" must be an object, "${data}" provided`)
        }

        let isStrict = schema.flexible !== true

        let propList = new Set()
        Object.keys(schema.properties).forEach(propName => propList.add(propName))
        Object.keys(data).forEach(propName => propList.add(propName))

        for (let propName of propList) {
            let propSchema = typeof schema.properties[propName] === 'object' ? schema.properties[propName] : null
            if (propSchema === null && isStrict) {
                throw new Error(`property "${propName}" is not expected`)
            } else if (propSchema === null && !isStrict) {
                continue
            }

            if (typeof data[propName] === 'undefined' && propSchema.required === false) {
                continue
            }

            let validator = this.validators.get(propSchema.type)
            validator(propName, propSchema, data[propName])
        }
    }

    /**
     * @private
     * @type {ValidationFn}
     */
    validateArray = (propertyName, schema, data) => {

        if (!Array.isArray(data)) {
            throw new Error(`property "${propertyName}" must be an array, "${data}" provided`)
        }

        if (typeof schema.items !== 'object') {
            return
        }

        let validator = this.validators.get(schema.items.type)

        for (let [ index, item ] of data.entries()) {
            validator(`${propertyName}[${index}]`, schema.items, item)
        }

    }

    
    /**
     * @private
     * @type {ValidationFn}
     */
    validateEmail = (propertyName, schema, data) => {

        const mailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g

        if (typeof data !== 'string') {
            throw new Error(`property "${propertyName}" must be a string, "${data}" provided`)
        }
        
        if(!mailRegex.test(data)) {
            throw new Error(`property "${propertyName}" must be a valid email address, "${data}" provided`)
        }
    }

}

export default JSONSchema