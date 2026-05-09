import { pipe, traverseEntity } from './sanitize'
import { FieldRule, FieldSchema, Visitor } from './types'
import {
	allowOnly,
	removePrivate,
	removeReadonly,
	removeRestricted,
	removeUnknown,
	removeWriteOnly,
} from './visitors'

export interface SanitizerVisitors<T extends object> {
	input?: Visitor<T>[]
	output?: Visitor<T>[]
	query?: Visitor<T>[]
}

export interface SanitizerOptions<T extends object> {
	sanitizers?: SanitizerVisitors<T>
}

export interface InputCallOptions {
	strict?: boolean
	restrictedFields?: readonly string[]
}

export interface OutputCallOptions {
	restrictedFields?: readonly string[]
}

export interface QueryCallOptions {
	strict?: boolean
	allowedKeys?: readonly string[]
}

interface CompiledField {
	skipInput: boolean
	skipOutput: boolean
	skipQuery: boolean
}

interface InputEntry<T extends object> {
	plain: Visitor<T>
	strict: Visitor<T>
}

const FALLBACK_FIELD: CompiledField = Object.freeze({
	skipInput: false,
	skipOutput: false,
	skipQuery: false,
})

type Compiled = { fields: Record<string, CompiledField>; keys: string[] }
const compiledSchemaCache = new WeakMap<object, Compiled>()

function compileSchema<T extends object>(
	schema: FieldSchema<T>,
): Compiled {
	const cached = compiledSchemaCache.get(schema as object)
	if (cached) return cached
	const fields: Record<string, CompiledField> = Object.create(null)
	const keys: string[] = []
	for (const key of Object.keys(schema) as string[]) {
		const rule = (schema as Record<string, FieldRule | undefined>)[key]
		fields[key] = {
			skipInput: rule?.readonly === true,
			skipOutput: rule?.private === true || rule?.writeOnly === true,
			skipQuery: rule?.private === true || rule?.writeOnly === true,
		}
		keys.push(key)
	}
	const out: Compiled = { fields, keys }
	compiledSchemaCache.set(schema as object, out)
	return out
}

function buildRestrictSet(restricted: readonly string[]): Set<string> {
	return new Set(restricted)
}

export function createSanitizer<T extends object>(
	schema: FieldSchema<T>,
	opts: SanitizerOptions<T> = {},
) {
	const userInput = opts.sanitizers?.input ?? []
	const userOutput = opts.sanitizers?.output ?? []
	const userQuery = opts.sanitizers?.query ?? []
	const hasCustomInput = userInput.length > 0
	const hasCustomOutput = userOutput.length > 0
	const hasCustomQuery = userQuery.length > 0
	const fastPath = !hasCustomInput && !hasCustomOutput && !hasCustomQuery

	const { fields: compiled } = compileSchema(schema)
	const schemaKeys = Object.keys(schema) as string[]

	const baseInput: Visitor<T>[] = [removeReadonly, ...userInput]
	const baseOutput: Visitor<T>[] = [removePrivate, removeWriteOnly, ...userOutput]
	const baseQuery: Visitor<T>[] = [removePrivate, removeWriteOnly, ...userQuery]

	const staticInputPipe = pipe(...baseInput)
	const staticInputStrictPipe = pipe(...baseInput, removeUnknown as Visitor<T>)
	const staticOutputPipe = pipe(...baseOutput)
	const staticQueryPipe = pipe(...baseQuery)
	const staticQueryStrictPipe = pipe(
		...baseQuery,
		allowOnly(schemaKeys) as Visitor<T>,
	)

	const inputCache = new WeakMap<readonly string[], InputEntry<T>>()
	const outputCache = new WeakMap<readonly string[], Visitor<T>>()
	const queryStrictCache = new WeakMap<readonly string[], Visitor<T>>()
	const restrictedSetCache = new WeakMap<readonly string[], Set<string>>()
	const allowedSetCache = new WeakMap<readonly string[], Set<string>>()

	const restrictedSet = (restricted: readonly string[]): Set<string> => {
		let cached = restrictedSetCache.get(restricted)
		if (!cached) {
			cached = buildRestrictSet(restricted)
			restrictedSetCache.set(restricted, cached)
		}
		return cached
	}

	const allowedSet = (allowedKeys: readonly string[]): Set<string> => {
		let cached = allowedSetCache.get(allowedKeys)
		if (!cached) {
			cached = new Set<string>(schemaKeys)
			for (const k of allowedKeys) cached.add(k)
			allowedSetCache.set(allowedKeys, cached)
		}
		return cached
	}

	const resolveInput = (strict: boolean, restricted?: readonly string[]): Visitor<T> => {
		if (!restricted) return strict ? staticInputStrictPipe : staticInputPipe
		let entry = inputCache.get(restricted)
		if (!entry) {
			const restrict = removeRestricted(restricted) as Visitor<T>
			entry = {
				plain: pipe(...baseInput, restrict),
				strict: pipe(...baseInput, removeUnknown as Visitor<T>, restrict),
			}
			inputCache.set(restricted, entry)
		}
		return strict ? entry.strict : entry.plain
	}

	const resolveOutput = (restricted?: readonly string[]): Visitor<T> => {
		if (!restricted) return staticOutputPipe
		let cached = outputCache.get(restricted)
		if (!cached) {
			cached = pipe(...baseOutput, removeRestricted(restricted) as Visitor<T>)
			outputCache.set(restricted, cached)
		}
		return cached
	}

	const resolveQuery = (strict: boolean, allowedKeys?: readonly string[]): Visitor<T> => {
		if (!strict) return staticQueryPipe
		if (!allowedKeys || allowedKeys.length === 0) return staticQueryStrictPipe
		let cached = queryStrictCache.get(allowedKeys)
		if (!cached) {
			const allowed = [...schemaKeys, ...allowedKeys]
			cached = pipe(...baseQuery, allowOnly(allowed) as Visitor<T>)
			queryStrictCache.set(allowedKeys, cached)
		}
		return cached
	}

	const fastInput = (
		data: unknown,
		strict: boolean,
		restricted: Set<string> | undefined,
	): unknown => {
		if (Array.isArray(data)) {
			const out = new Array<unknown>(data.length)
			for (let i = 0; i < data.length; i++) {
				out[i] = fastInput(data[i], strict, restricted)
			}
			return out
		}
		if (data === null || typeof data !== 'object') return data
		const source = data as Record<string, unknown>
		const result: Record<string, unknown> = {}
		for (const key of Object.keys(source)) {
			const field = compiled[key]
			if (!field) {
				if (strict) continue
				if (restricted?.has(key)) continue
				result[key] = source[key]
				continue
			}
			if (field.skipInput) continue
			if (restricted?.has(key)) continue
			result[key] = source[key]
		}
		return result
	}

	const fastOutput = (
		data: unknown,
		restricted: Set<string> | undefined,
	): unknown => {
		if (Array.isArray(data)) {
			const out = new Array<unknown>(data.length)
			for (let i = 0; i < data.length; i++) {
				out[i] = fastOutput(data[i], restricted)
			}
			return out
		}
		if (data === null || typeof data !== 'object') return data
		const source = data as Record<string, unknown>
		const result: Record<string, unknown> = {}
		for (const key of Object.keys(source)) {
			const field = compiled[key] ?? FALLBACK_FIELD
			if (field.skipOutput) continue
			if (restricted?.has(key)) continue
			result[key] = source[key]
		}
		return result
	}

	const fastQuery = (
		data: Record<string, unknown>,
		strict: boolean,
		allowed: Set<string> | undefined,
	): unknown => {
		const result: Record<string, unknown> = {}
		for (const key of Object.keys(data)) {
			if (strict) {
				if (allowed) {
					if (!allowed.has(key)) continue
				} else if (!compiled[key]) {
					continue
				}
			}
			const field = compiled[key]
			if (field?.skipQuery) continue
			result[key] = data[key]
		}
		return result
	}

	return {
		input(data: unknown, callOpts: InputCallOptions = {}): unknown {
			if (fastPath) {
				const restrictSet = callOpts.restrictedFields
					? restrictedSet(callOpts.restrictedFields)
					: undefined
				return fastInput(data, callOpts.strict ?? false, restrictSet)
			}
			return traverseEntity(
				resolveInput(callOpts.strict ?? false, callOpts.restrictedFields),
				schema,
				data,
			)
		},

		output(data: unknown, callOpts: OutputCallOptions = {}): unknown {
			if (fastPath) {
				const restrictSet = callOpts.restrictedFields
					? restrictedSet(callOpts.restrictedFields)
					: undefined
				return fastOutput(data, restrictSet)
			}
			return traverseEntity(
				resolveOutput(callOpts.restrictedFields),
				schema,
				data,
			)
		},

		query(query: Record<string, unknown>, callOpts: QueryCallOptions = {}): unknown {
			if (fastPath) {
				const allowed = callOpts.allowedKeys
					? allowedSet(callOpts.allowedKeys)
					: undefined
				return fastQuery(query, callOpts.strict ?? false, allowed)
			}
			return traverseEntity(
				resolveQuery(callOpts.strict ?? false, callOpts.allowedKeys),
				schema,
				query,
			)
		},
	}
}

export type Sanitizer<T extends object> = ReturnType<typeof createSanitizer<T>>
