import { ValidationError } from '../errors'
import { FieldRule, FieldSchema } from './sanitize'
import { FILTER_OP_SET, Filter, FilterOp } from './filter'

export type CoerceType = 'integer' | 'number' | 'boolean' | 'date'

export interface ParseFiltersOptions<T extends object> {
	schema?: FieldSchema<T>
	allowedFields?: ReadonlyArray<keyof T & string>
	coerceFields?: Partial<Record<keyof T & string, CoerceType>>
	reservedKeys?: ReadonlyArray<string>
}

const DEFAULT_RESERVED: ReadonlyArray<string> = ['offset', 'limit', 'sort', 'cursor']

const BOOLEAN_OPS: ReadonlySet<string> = new Set(['isNull', 'isNotNull'])
const STRING_OPS: ReadonlySet<string> = new Set(['like', 'ilike'])
const ARRAY_OPS: ReadonlySet<string> = new Set(['in', 'notIn'])

export function parseFilters<T extends object = Record<string, unknown>>(
	query: Record<string, unknown>,
	options: ParseFiltersOptions<T> = {},
): Filter<T> {
	const reserved = new Set<string>(options.reservedKeys ?? DEFAULT_RESERVED)
	const allowed = options.allowedFields ? new Set<string>(options.allowedFields) : null
	const out: Record<string, unknown> = {}

	for (const key of Object.keys(query)) {
		if (reserved.has(key)) continue
		if (allowed && !allowed.has(key)) {
			throw new ValidationError(`Unknown filter field: ${key}`)
		}
		const raw = query[key]
		const coerceType = resolveCoerceType<T>(key, options)

		if (raw === null) {
			out[key] = null
			continue
		}

		if (Array.isArray(raw)) {
			out[key] = raw.map((v) => coerceLeaf(v, coerceType, key, 'eq'))
			continue
		}

		if (isPlainObject(raw)) {
			const opEntries = Object.entries(raw as Record<string, unknown>)
			if (opEntries.length === 0) continue
			const condition: Record<string, unknown> = {}
			let any = false
			for (const [op, opValue] of opEntries) {
				if (!FILTER_OP_SET.has(op)) {
					throw new ValidationError(`Unknown filter op: ${key}[${op}]`)
				}
				const coerced = coerceOpValue(opValue, op as FilterOp, coerceType, key)
				if (coerced === DROP) continue
				condition[op] = coerced
				any = true
			}
			if (any) out[key] = condition
			continue
		}

		out[key] = coerceLeaf(raw, coerceType, key, 'eq')
	}

	return out as Filter<T>
}

const DROP = Symbol('drop')

function resolveCoerceType<T extends object>(
	key: string,
	options: ParseFiltersOptions<T>,
): CoerceType | undefined {
	const override = options.coerceFields?.[key as keyof T & string]
	if (override) return override
	const rule = options.schema?.[key as keyof T] as FieldRule | undefined
	const type = rule?.type
	if (type === 'integer' || type === 'number' || type === 'boolean' || type === 'date') {
		return type
	}
	return undefined
}

function coerceOpValue(
	raw: unknown,
	op: FilterOp,
	coerceType: CoerceType | undefined,
	key: string,
): unknown {
	if (BOOLEAN_OPS.has(op)) {
		if (parseBoolean(raw) === true) return true
		return DROP
	}
	if (ARRAY_OPS.has(op)) {
		const arr = toArray(raw)
		return arr.map((v) => coerceLeaf(v, coerceType, key, op))
	}
	if (STRING_OPS.has(op)) {
		if (typeof raw !== 'string') {
			throw new ValidationError(`Filter ${key}[${op}] must be string`)
		}
		return raw
	}
	return coerceLeaf(raw, coerceType, key, op)
}

function toArray(value: unknown): unknown[] {
	if (Array.isArray(value)) return value
	if (typeof value === 'string') {
		if (value === '') return []
		return value.split(',')
	}
	return [value]
}

function coerceLeaf(
	raw: unknown,
	coerceType: CoerceType | undefined,
	key: string,
	op: string,
): unknown {
	if (raw === null) return null
	if (!coerceType) return raw
	if (typeof raw !== 'string') return raw
	switch (coerceType) {
		case 'integer': {
			const n = Number(raw)
			if (!Number.isInteger(n)) {
				throw new ValidationError(`Filter ${key}[${op}] not an integer: ${raw}`)
			}
			return n
		}
		case 'number': {
			const n = Number(raw)
			if (!Number.isFinite(n)) {
				throw new ValidationError(`Filter ${key}[${op}] not a number: ${raw}`)
			}
			return n
		}
		case 'boolean': {
			const b = parseBoolean(raw)
			if (b === undefined) {
				throw new ValidationError(`Filter ${key}[${op}] not a boolean: ${raw}`)
			}
			return b
		}
		case 'date': {
			const d = new Date(raw)
			if (Number.isNaN(d.getTime())) {
				throw new ValidationError(`Filter ${key}[${op}] not a date: ${raw}`)
			}
			return d
		}
	}
}

function parseBoolean(raw: unknown): boolean | undefined {
	if (typeof raw === 'boolean') return raw
	if (typeof raw === 'number') {
		if (raw === 1) return true
		if (raw === 0) return false
		return undefined
	}
	if (typeof raw !== 'string') return undefined
	const lowered = raw.toLowerCase()
	if (lowered === 'true' || lowered === '1') return true
	if (lowered === 'false' || lowered === '0' || lowered === '') return false
	return undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false
	if (Array.isArray(value)) return false
	if (value instanceof Date) return false
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return false
	return true
}
