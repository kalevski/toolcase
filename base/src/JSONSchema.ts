type JSONDataType = string

interface Schema {
    type: JSONDataType
    required?: boolean
    properties?: Record<string, Schema>
    flexible?: boolean
    items?: Partial<Schema>
}

type ValidationFn = (propertyName: string | null, schema: Schema, data: any) => boolean | string | void

const USERNAME_REGEX = /^[A-z][A-z0-9-_]{3,23}$/
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,24}$/
const EMAIL_REGEX = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/

class JSONSchema {

    private validators: Map<string, ValidationFn> = new Map()

    private schema: Schema

    constructor(schema: Schema) {
        this.register('string', this.validateString)
        this.register('boolean', this.validateBoolean)
        this.register('number', this.validateNumber)
        this.register('object', this.validateObject)
        this.register('array', this.validateArray)

        this.register('email', this.validateEmail)
        this.register('username', this.validateUsername)
        this.register('password', this.validatePassword)
        this.register('url', this.validateUrl)
        
        this.validateSchema(schema)
        this.schema = schema
    }

    register(type: string, validationFn: ValidationFn): void {
        
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

    validate(data: any): void {
        const validator = this.validators.get(this.schema.type) || null
        if (validator === null) {
            throw new Error(`validator for type=${this.schema.type} is not registered`)
        }
        validator('@', this.schema, data)
    }

    private validateSchema(schema: Schema): void {
        
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
            this.validateSchema(schema.items as Schema)
        }

        for (const property in schema.properties) {
            this.validateSchema(schema.properties[property])
        }
    }

    private validateString: ValidationFn = (propertyName, schema, data) => {
        if (typeof data !== 'string') {
            throw new Error(`property=${propertyName} must be a string, value=${data} type=${typeof data} provided`)
        }
    }

    private validateBoolean: ValidationFn = (propertyName, schema, data) => {
        if (typeof data !== 'boolean') {
            throw new Error(`property=${propertyName} can be "true" or "false", value=${data} type=${typeof data} provided`)
        }
    }

    private validateNumber: ValidationFn = (propertyName, schema, data) => {
        if (typeof data !== 'number') {
            throw new Error(`property=${propertyName} must be a number, value=${data} type=${typeof data} provided`)
        }
    }

    private validateObject: ValidationFn = (propertyName, schema, data) => {

        const here = propertyName ?? '@'

        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error(`property=${here} must be an object, value=${data} type=${typeof data} provided`)
        }

        const isStrict = schema.flexible !== true
        const schemaProperties = schema.properties || {}

        const propList = new Set<string>()
        Object.keys(schemaProperties).forEach(propName => propList.add(propName))
        Object.keys(data).forEach(propName => propList.add(propName))
        for (const propName of propList) {

            const childPath = here === '@' ? propName : `${here}.${propName}`
            const propSchema = typeof schemaProperties[propName] === 'object' ? schemaProperties[propName] : null

            if (propSchema === null && isStrict) {
                throw new Error(`property=${childPath} is not expected`)
            } else if (propSchema === null && !isStrict) {
                continue
            }
            const required = typeof propSchema!.required === 'boolean' ? propSchema!.required : false
            if (typeof data[propName] === 'undefined' && required === false) {
                continue
            }

            const validator = this.validators.get(propSchema!.type) || null
            if (validator === null) {
                throw new Error(`validator for type=${propSchema!.type} is not registered`)
            }
            validator(childPath, propSchema!, data[propName])
        }
    }

    private validateArray: ValidationFn = (propertyName, schema, data) => {

        const here = propertyName ?? '@'

        if (!Array.isArray(data)) {
            throw new Error(`property=${here} must be an array, value=${data} type=${typeof data} provided`)
        }

        if (typeof schema.items !== 'object') {
            return
        }

        const validator = this.validators.get(schema.items!.type!)!

        for (const [ index, item ] of data.entries()) {
            const itemPath = here === '@' ? `[${index}]` : `${here}[${index}]`
            validator(itemPath, schema.items as Schema, item)
        }

    }

    private validateEmail: ValidationFn = (propertyName, schema, data) => {

        if (typeof data !== 'string') {
            throw new Error(`property "${propertyName}" must be a string, value=${data} type=${typeof data} provided`)
        }
        
        if(!EMAIL_REGEX.test(data)) {
            throw new Error(`property "${propertyName}" must be a valid email address, value=${data} type=${typeof data} provided`)
        }
    }

    private validateUsername: ValidationFn = (propertyName, schema, data) => {

        if (typeof data !== 'string') {
            throw new Error(`property=${propertyName} must be a string, value=${data} type=${typeof data} provided`)
        }
        
        if(!USERNAME_REGEX.test(data)) {
            throw new Error(`property=${propertyName} must contain letter and the length must be between 3 and 23 characters, "${data}" provided`)
        }
    }

    private validatePassword: ValidationFn = (propertyName, schema, data) => {

        if (typeof data !== 'string') {
            throw new Error(`property=${propertyName} must be a string, value=${data} type=${typeof data} provided`)
        }
        
        if(!PASSWORD_REGEX.test(data)) {
            throw new Error(`property=${propertyName} is to weak for password`)
        }
    }

    private validateUrl: ValidationFn = (propertyName, schema, data) => {
        if (typeof data !== 'string') {
            throw new Error(`property=${propertyName} must be a string, value=${data} type=${typeof data} provided`)
        }
        
        if(!URL_REGEX.test(data)) {
            throw new Error(`property=${propertyName} is must be a valid URL`)
        }
    }

}

export default JSONSchema
