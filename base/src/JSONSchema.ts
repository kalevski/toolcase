type PrimitiveTypeName =
    | 'string'
    | 'boolean'
    | 'number'
    | 'integer'
    | 'email'
    | 'username'
    | 'password'
    | 'url'
    | 'uuid'
    | 'date'
    | 'datetime'
    | 'ipv4'
    | 'ipv6'
    | 'hex'
    | 'slug'
    | 'semver'
    | 'base64'

interface BaseSchema {
    required?: boolean
    enum?: unknown[]
    minLength?: number
    maxLength?: number
    pattern?: string
    min?: number
    max?: number
    minItems?: number
    maxItems?: number
    $defs?: Record<string, Schema>
}

interface PrimitiveSchema extends BaseSchema {
    type: PrimitiveTypeName
}

interface ObjectSchema extends BaseSchema {
    type: 'object'
    flexible?: boolean
    properties?: Record<string, Schema>
}

interface ArraySchema extends BaseSchema {
    type: 'array'
    items?: Schema
}

interface CustomSchema extends BaseSchema {
    type: string & {}
    flexible?: boolean
    properties?: Record<string, Schema>
    items?: Schema
}

export interface RefSchema {
    $ref: string
    required?: boolean
    $defs?: Record<string, Schema>
}

export type Schema =
    | PrimitiveSchema
    | ObjectSchema
    | ArraySchema
    | CustomSchema
    | RefSchema

export interface JSONSchemaOptions {
    coerce?: boolean
}

interface RawSchema {
    type?: string
    $ref?: string
    $defs?: Record<string, RawSchema>
    required?: boolean
    flexible?: boolean
    properties?: Record<string, RawSchema>
    items?: RawSchema
    enum?: unknown[]
    minLength?: number
    maxLength?: number
    pattern?: string
    min?: number
    max?: number
    minItems?: number
    maxItems?: number
}

export interface ValidationIssue {
    path: string
    message: string
}

export interface ValidationError {
    issues: ValidationIssue[]
}

export type ValidationFn = (
    propertyName: string | null,
    schema: RawSchema,
    data: any,
    issues: ValidationIssue[]
) => void

const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]{2,22}$/
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-={}\[\]|:;"'<>,.?\/~`]).{8,24}$/
const EMAIL_REGEX = /^(?:(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\]))$/
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const DATETIME_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/
const IPV4_REGEX = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-((0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(\+([0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*))?$/
const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const PRIMITIVE_LEAF_TYPES = new Set([
    'string',
    'boolean',
    'number',
    'integer',
    'email',
    'username',
    'password',
    'url',
    'uuid',
    'date',
    'datetime',
    'ipv4',
    'ipv6',
    'hex',
    'slug',
    'semver',
    'base64'
])

function cloneSchema<T>(schema: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(schema)
    }
    return JSON.parse(JSON.stringify(schema))
}

function pathOf(propertyName: string | null): string {
    return propertyName ?? '@'
}

class JSONSchema<const S extends Schema = Schema> {

    private validators: Map<string, ValidationFn> = new Map()

    private schema: S

    private defs: Map<string, RawSchema> = new Map()

    private isSchemaValidated: boolean = false

    private latestError: ValidationError | null = null

    constructor(schema: S, customValidators?: Record<string, ValidationFn>, _options?: JSONSchemaOptions) {
        this.register('string', this.validateString)
        this.register('boolean', this.validateBoolean)
        this.register('number', this.validateNumber)
        this.register('integer', this.validateInteger)
        this.register('object', this.validateObject)
        this.register('array', this.validateArray)

        this.register('email', this.validateEmail)
        this.register('username', this.validateUsername)
        this.register('password', this.validatePassword)
        this.register('url', this.validateUrl)
        this.register('uuid', this.validateUuid)
        this.register('date', this.validateDate)
        this.register('datetime', this.validateDateTime)
        this.register('ipv4', this.validateIpv4)
        this.register('ipv6', this.validateIpv6)
        this.register('hex', this.validateHex)
        this.register('slug', this.validateSlug)
        this.register('semver', this.validateSemver)
        this.register('base64', this.validateBase64)

        if (customValidators !== undefined && customValidators !== null) {
            for (const type in customValidators) {
                this.register(type, customValidators[type])
            }
        }

        if (schema === null || typeof schema !== 'object') {
            throw new Error(`schema must be an object, "${schema}" provided`)
        }

        this.schema = cloneSchema(schema)

        // Extract $defs from the root schema (only root-level definitions are supported)
        const rawRoot = this.schema as any
        const rawDefs = rawRoot.$defs ?? rawRoot.definitions
        if (rawDefs !== null && rawDefs !== undefined && typeof rawDefs === 'object') {
            for (const key of Object.keys(rawDefs)) {
                this.defs.set(key, rawDefs[key] as RawSchema)
            }
        }
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
        this.isSchemaValidated = false
    }

    validate(data: any): boolean {
        if (!this.isSchemaValidated) {
            this.validateSchema(this.schema as RawSchema)
            for (const defSchema of this.defs.values()) {
                this.validateSchema(defSchema)
            }
            this.isSchemaValidated = true
        }

        const issues: ValidationIssue[] = []
        const resolvedSchema = this.resolveRef(this.schema as RawSchema)

        if (typeof data === 'undefined') {
            if (resolvedSchema.required === true) {
                issues.push({ path: '@', message: 'property=@ is required' })
            }
        } else {
            const validator = this.validators.get(resolvedSchema.type!) ?? null
            if (validator === null) {
                issues.push({ path: '@', message: `validator for type=${resolvedSchema.type} is not registered` })
            } else {
                this.runValidator(validator, null, resolvedSchema, data, issues)
            }
        }

        if (issues.length === 0) {
            this.latestError = null
            return true
        }

        this.latestError = { issues }
        return false
    }

    /**
     * Coerce `data` toward the schema's expected types then validate.
     *
     * Supported coercions:
     * - string → number / integer (when the string is a valid number)
     * - string "true"/"false"/"1"/"0" → boolean
     * - number or boolean → string
     * - nested object properties and array items are coerced recursively
     *
     * Returns the (possibly coerced) value. On failure `getLatestError()` is
     * populated with the validation issues.
     */
    coerce(data: unknown): unknown {
        const coerced = this.applyCoercion(this.schema as RawSchema, data)
        this.validate(coerced)
        return coerced
    }

    getLatestError(): ValidationError | null {
        return this.latestError
    }

    // ── $ref helpers ──────────────────────────────────────────────────────────

    private parseRefName(ref: string): string {
        const m = ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/)
        return m ? m[1] : ref
    }

    private resolveRef(schema: RawSchema, depth = 0): RawSchema {
        if (!schema.$ref) return schema
        if (depth > 16) throw new Error(`$ref cycle detected (depth limit): "${schema.$ref}"`)
        const name = this.parseRefName(schema.$ref)
        const target = this.defs.get(name)
        if (!target) throw new Error(`$ref "${schema.$ref}" not found in $defs`)
        return this.resolveRef(target, depth + 1)
    }

    // ── coercion ─────────────────────────────────────────────────────────────

    private applyCoercion(schema: RawSchema, data: unknown): unknown {
        let resolved: RawSchema
        try {
            resolved = this.resolveRef(schema)
        } catch {
            return data
        }

        switch (resolved.type) {
            case 'number': {
                if (typeof data === 'string') {
                    const n = Number(data)
                    if (!Number.isNaN(n) && Number.isFinite(n)) return n
                }
                return data
            }
            case 'integer': {
                if (typeof data === 'string') {
                    const n = Number(data)
                    if (!Number.isNaN(n) && Number.isFinite(n)) return Math.trunc(n)
                }
                return data
            }
            case 'boolean': {
                if (data === 'true' || data === '1') return true
                if (data === 'false' || data === '0') return false
                return data
            }
            case 'string': {
                if (typeof data === 'number' || typeof data === 'boolean') return String(data)
                return data
            }
            case 'object': {
                if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
                    const record = data as Record<string, unknown>
                    const result: Record<string, unknown> = {}
                    for (const key of Object.keys(record)) {
                        result[key] = record[key]
                    }
                    const props = resolved.properties ?? {}
                    for (const key of Object.keys(props)) {
                        if (key in record) {
                            result[key] = this.applyCoercion(props[key], record[key])
                        }
                    }
                    return result
                }
                return data
            }
            case 'array': {
                if (Array.isArray(data) && resolved.items !== undefined) {
                    return data.map((item: unknown) => this.applyCoercion(resolved.items!, item))
                }
                return data
            }
            default:
                return data
        }
    }

    // ── internal validation ───────────────────────────────────────────────────

    private runValidator(
        validator: ValidationFn,
        propertyName: string | null,
        schema: RawSchema,
        data: any,
        issues: ValidationIssue[]
    ): void {
        try {
            validator(propertyName, schema, data, issues)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            issues.push({ path: pathOf(propertyName), message })
        }
    }

    private validateSchema(schema: RawSchema): void {

        if (schema === null || typeof schema !== 'object') {
            throw new Error(`schema must be an object, "${schema}" provided`)
        }

        // $ref schema: just verify the target exists; the target will be validated separately
        if (schema.$ref !== undefined) {
            if (typeof schema.$ref !== 'string') {
                throw new Error(`schema $ref must be a string`)
            }
            const name = this.parseRefName(schema.$ref)
            if (!this.defs.has(name)) {
                throw new Error(`$ref "${schema.$ref}" not found in $defs`)
            }
            return
        }

        if (typeof schema.type !== 'string') {
            throw new Error(`schema type must be a string, "${schema.type}" provided`)
        }

        if (!this.validators.has(schema.type)) {
            throw new Error(`schema type does not exist, "${schema.type}" provided`)
        }

        if (schema.items !== undefined && schema.items !== null) {
            if (PRIMITIVE_LEAF_TYPES.has(schema.type) || schema.type === 'object') {
                throw new Error(`schema type "${schema.type}" cannot define "items"`)
            }
            if (typeof schema.items !== 'object') {
                throw new Error(`schema "items" must be a schema object, "${schema.items}" provided`)
            }
            this.validateSchema(schema.items)
        }

        if (schema.properties !== undefined && schema.properties !== null) {
            if (PRIMITIVE_LEAF_TYPES.has(schema.type) || schema.type === 'array') {
                throw new Error(`schema type "${schema.type}" cannot define "properties"`)
            }
            if (typeof schema.properties !== 'object') {
                throw new Error(`schema "properties" must be an object, "${schema.properties}" provided`)
            }
            for (const property in schema.properties) {
                this.validateSchema(schema.properties[property])
            }
        }
    }

    private validateString: ValidationFn = (propertyName, schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (schema.minLength !== undefined && data.length < schema.minLength) {
            issues.push({ path: here, message: `property=${here} must be at least ${schema.minLength} characters long` })
        }
        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
            issues.push({ path: here, message: `property=${here} must be at most ${schema.maxLength} characters long` })
        }
        if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
            issues.push({ path: here, message: `property=${here} must match pattern ${schema.pattern}` })
        }
        if (schema.enum !== undefined && !schema.enum.includes(data)) {
            issues.push({ path: here, message: `property=${here} must be one of [${schema.enum.join(', ')}]` })
        }
    }

    private validateBoolean: ValidationFn = (propertyName, schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'boolean') {
            issues.push({
                path: here,
                message: `property=${here} can be "true" or "false", value=${data} type=${typeof data} provided`
            })
            return
        }
        if (schema.enum !== undefined && !schema.enum.includes(data)) {
            issues.push({ path: here, message: `property=${here} must be one of [${schema.enum.join(', ')}]` })
        }
    }

    private validateNumber: ValidationFn = (propertyName, schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'number') {
            issues.push({
                path: here,
                message: `property=${here} must be a number, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (schema.min !== undefined && data < schema.min) {
            issues.push({ path: here, message: `property=${here} must be >= ${schema.min}` })
        }
        if (schema.max !== undefined && data > schema.max) {
            issues.push({ path: here, message: `property=${here} must be <= ${schema.max}` })
        }
        if (schema.enum !== undefined && !schema.enum.includes(data)) {
            issues.push({ path: here, message: `property=${here} must be one of [${schema.enum.join(', ')}]` })
        }
    }

    private validateInteger: ValidationFn = (propertyName, schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'number' || !Number.isInteger(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be an integer, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (schema.min !== undefined && data < schema.min) {
            issues.push({ path: here, message: `property=${here} must be >= ${schema.min}` })
        }
        if (schema.max !== undefined && data > schema.max) {
            issues.push({ path: here, message: `property=${here} must be <= ${schema.max}` })
        }
        if (schema.enum !== undefined && !schema.enum.includes(data)) {
            issues.push({ path: here, message: `property=${here} must be one of [${schema.enum.join(', ')}]` })
        }
    }

    private validateObject: ValidationFn = (propertyName, schema, data, issues) => {

        const here = pathOf(propertyName)

        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be an object, value=${data} type=${typeof data} provided`
            })
            return
        }

        const isStrict = schema.flexible !== true
        const schemaProperties = schema.properties ?? {}
        const dataRecord = data as Record<string, unknown>

        const propList = new Set<string>()
        Object.keys(schemaProperties).forEach(propName => propList.add(propName))
        Object.keys(dataRecord).forEach(propName => propList.add(propName))

        for (const propName of propList) {

            const childPath = here === '@' ? propName : `${here}.${propName}`
            const rawProp = schemaProperties[propName]
            const propSchemaObj = (rawProp !== null && rawProp !== undefined && typeof rawProp === 'object')
                ? rawProp as RawSchema
                : null

            if (propSchemaObj === null && isStrict) {
                issues.push({
                    path: childPath,
                    message: `property=${childPath} is not expected`
                })
                continue
            } else if (propSchemaObj === null) {
                continue
            }

            // Resolve $ref if present
            let propSchema = propSchemaObj
            if (propSchemaObj.$ref !== undefined) {
                try {
                    propSchema = this.resolveRef(propSchemaObj)
                } catch (e) {
                    issues.push({ path: childPath, message: (e as Error).message })
                    continue
                }
            }

            // required is on the declaring schema, not the resolved target
            const required = propSchemaObj.required === true
            const isMissing = typeof dataRecord[propName] === 'undefined'

            if (isMissing) {
                if (required) {
                    issues.push({
                        path: childPath,
                        message: `property=${childPath} is required`
                    })
                }
                continue
            }

            const validator = this.validators.get(propSchema.type!) ?? null
            if (validator === null) {
                issues.push({
                    path: childPath,
                    message: `validator for type=${propSchema.type} is not registered`
                })
                continue
            }
            this.runValidator(validator, childPath, propSchema, dataRecord[propName], issues)
        }
    }

    private validateArray: ValidationFn = (propertyName, schema, data, issues) => {

        const here = pathOf(propertyName)

        if (!Array.isArray(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be an array, value=${data} type=${typeof data} provided`
            })
            return
        }

        if (schema.minItems !== undefined && data.length < schema.minItems) {
            issues.push({ path: here, message: `property=${here} must have at least ${schema.minItems} items` })
        }
        if (schema.maxItems !== undefined && data.length > schema.maxItems) {
            issues.push({ path: here, message: `property=${here} must have at most ${schema.maxItems} items` })
        }

        if (schema.items === null || typeof schema.items !== 'object') {
            return
        }

        // Resolve $ref on the items schema
        let itemSchema = schema.items
        if (itemSchema.$ref !== undefined) {
            try {
                itemSchema = this.resolveRef(itemSchema)
            } catch (e) {
                issues.push({ path: here, message: (e as Error).message })
                return
            }
        }

        const validator = this.validators.get(itemSchema.type!) ?? null
        if (validator === null) {
            issues.push({
                path: here,
                message: `validator for type=${itemSchema.type} is not registered`
            })
            return
        }

        for (const [ index, item ] of data.entries()) {
            const itemPath = here === '@' ? `[${index}]` : `${here}[${index}]`
            this.runValidator(validator, itemPath, itemSchema, item, issues)
        }

    }

    private validateEmail: ValidationFn = (propertyName, _schema, data, issues) => {

        const here = pathOf(propertyName)

        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property "${here}" must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }

        if (!EMAIL_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property "${here}" must be a valid email address, value=${data} type=${typeof data} provided`
            })
        }
    }

    private validateUsername: ValidationFn = (propertyName, _schema, data, issues) => {

        const here = pathOf(propertyName)

        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }

        if (!USERNAME_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must start with a letter and be between 3 and 23 characters, "${data}" provided`
            })
        }
    }

    private validatePassword: ValidationFn = (propertyName, _schema, data, issues) => {

        const here = pathOf(propertyName)

        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }

        if (!PASSWORD_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} is too weak for password`
            })
        }
    }

    private validateUrl: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }

        if (!URL_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid URL`
            })
        }
    }

    private validateUuid: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!UUID_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid UUID`
            })
        }
    }

    private validateDate: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!DATE_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid ISO date (YYYY-MM-DD)`
            })
        }
    }

    private validateDateTime: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!DATETIME_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid ISO 8601 datetime`
            })
        }
    }

    private validateIpv4: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!IPV4_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid IPv4 address`
            })
        }
    }

    private validateIpv6: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!IPV6_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid IPv6 address`
            })
        }
    }

    private validateHex: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!HEX_COLOR_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid hex color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)`
            })
        }
    }

    private validateSlug: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!SLUG_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid slug (lowercase alphanumerics separated by single dashes)`
            })
        }
    }

    private validateSemver: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (!SEMVER_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid semver version`
            })
        }
    }

    private validateBase64: ValidationFn = (propertyName, _schema, data, issues) => {
        const here = pathOf(propertyName)
        if (typeof data !== 'string') {
            issues.push({
                path: here,
                message: `property=${here} must be a string, value=${data} type=${typeof data} provided`
            })
            return
        }
        if (data.length === 0 || data.length % 4 !== 0 || !BASE64_REGEX.test(data)) {
            issues.push({
                path: here,
                message: `property=${here} must be a valid base64 string`
            })
        }
    }

}

export default JSONSchema
