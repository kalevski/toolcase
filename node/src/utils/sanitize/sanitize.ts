import { FieldSchema, Visitor, VisitorActions, VisitorContext } from './types'

export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function pipe<T extends object>(...visitors: Visitor<T>[]): Visitor<T> {
	return (ctx, actions) => {
		for (const visitor of visitors) {
			visitor(ctx, actions)
		}
	}
}

export function traverseEntity<T extends object = Record<string, unknown>>(
	visitor: Visitor<T>,
	schema: FieldSchema<T>,
	data: unknown,
	parentPath = '',
): unknown {
	if (Array.isArray(data)) {
		return data.map((entry) => traverseEntity(visitor, schema, entry, parentPath))
	}
	if (data === null || typeof data !== 'object') {
		return data
	}

	const source = data as Record<string, unknown>
	const result: Record<string, unknown> = {}

	for (const key of Object.keys(source)) {
		if (FORBIDDEN_KEYS.has(key)) continue
		const rule = (schema as Record<string, unknown>)[key] as
			| FieldSchema<T>[keyof T]
			| undefined
		const path = parentPath ? `${parentPath}.${key}` : key

		let removed = false
		let nextValue = source[key]

		const ctx: VisitorContext<T> = {
			key,
			value: source[key],
			rule: rule ?? undefined,
			schema,
			path,
		}
		const actions: VisitorActions = {
			remove: () => {
				removed = true
			},
			set: (value) => {
				nextValue = value
			},
		}

		visitor(ctx, actions)

		if (!removed) {
			result[key] = nextValue
		}
	}

	return result
}
