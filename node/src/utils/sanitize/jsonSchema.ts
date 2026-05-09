import { FieldRule, FieldSchema } from './types'

export interface JSONSchemaObject {
	type?: string | string[]
	properties?: Record<string, JSONSchemaObject>
	required?: string[]
	additionalProperties?: boolean
	items?: JSONSchemaObject
	pattern?: string
	format?: string
	minLength?: number
	maxLength?: number
	minimum?: number
	maximum?: number
	enum?: readonly (string | number | boolean | null)[]
}

export type DerivedSchemaMode = 'create' | 'update' | 'query'

export interface DeriveOptions {
	strict?: boolean
}

const NUMERIC_TYPES = new Set(['number', 'integer'])

function ruleType(rule: FieldRule): string | undefined {
	if (!rule.type) return undefined
	if (rule.type === 'date') return 'string'
	return rule.type
}

function ruleToJsonSchema(rule: FieldRule): JSONSchemaObject {
	const out: JSONSchemaObject = {}
	const type = ruleType(rule)
	if (type) out.type = type
	if (rule.type === 'date') out.format = 'date-time'
	if (rule.pattern) out.pattern = rule.pattern
	if (rule.format) out.format = rule.format
	if (rule.enum) out.enum = rule.enum
	if (rule.min !== undefined) {
		if (type === 'string') out.minLength = rule.min
		else if (type && NUMERIC_TYPES.has(type)) out.minimum = rule.min
	}
	if (rule.max !== undefined) {
		if (type === 'string') out.maxLength = rule.max
		else if (type && NUMERIC_TYPES.has(type)) out.maximum = rule.max
	}
	if (rule.type === 'array' && rule.items) {
		out.items = ruleToJsonSchema(rule.items)
	}
	return out
}

type DerivedCacheEntry = {
	loose: JSONSchemaObject
	strict: JSONSchemaObject
}
type DerivedCache = Map<DerivedSchemaMode, DerivedCacheEntry>
const derivedSchemaCache = new WeakMap<object, DerivedCache>()

function buildDerivedSchema<T extends object>(
	schema: FieldSchema<T>,
	mode: DerivedSchemaMode,
	strict: boolean,
): JSONSchemaObject {
	const properties: Record<string, JSONSchemaObject> = {}
	const required: string[] = []
	for (const key of Object.keys(schema) as (keyof T & string)[]) {
		const rule = schema[key]
		if (!rule) continue
		if (rule.private) continue
		if (mode === 'create' && rule.readonly) continue
		if (mode === 'update' && rule.readonly) continue
		properties[key] = ruleToJsonSchema(rule)
		if (mode === 'create' && rule.required) required.push(key)
	}
	const out: JSONSchemaObject = {
		type: 'object',
		properties,
	}
	if (required.length > 0) out.required = required
	if (strict) out.additionalProperties = false
	return out
}

export function deriveJsonSchema<T extends object>(
	schema: FieldSchema<T>,
	mode: DerivedSchemaMode,
	options: DeriveOptions = {},
): JSONSchemaObject {
	const strict = !!options.strict
	let perSchema = derivedSchemaCache.get(schema as object)
	if (!perSchema) {
		perSchema = new Map()
		derivedSchemaCache.set(schema as object, perSchema)
	}
	let entry = perSchema.get(mode)
	if (!entry) {
		entry = {
			loose: buildDerivedSchema(schema, mode, false),
			strict: buildDerivedSchema(schema, mode, true),
		}
		perSchema.set(mode, entry)
	}
	return strict ? entry.strict : entry.loose
}
