const OP_KEYS = [
	'eq',
	'ne',
	'gt',
	'gte',
	'lt',
	'lte',
	'like',
	'ilike',
	'in',
	'notIn',
	'isNull',
	'isNotNull',
] as const

export type WhereOp = typeof OP_KEYS[number]

export type WhereCondition<V> =
	| { eq: V }
	| { ne: V }
	| { gt: NonNullable<V> }
	| { gte: NonNullable<V> }
	| { lt: NonNullable<V> }
	| { lte: NonNullable<V> }
	| { like: string }
	| { ilike: string }
	| { in: NonNullable<V>[] }
	| { notIn: NonNullable<V>[] }
	| { isNull: true }
	| { isNotNull: true }

export type WhereMultiCondition<V> = {
	[K in WhereOp]?: K extends 'in' | 'notIn'
		? NonNullable<V>[]
		: K extends 'isNull' | 'isNotNull'
			? true
			: K extends 'like' | 'ilike'
				? string
				: V
}

export type WhereValue<V> = V | V[] | null | WhereCondition<V> | WhereMultiCondition<V>

export type WhereClause<T> = {
	[K in keyof T]?: WhereValue<T[K]>
}

export const OP_KEY_SET = new Set<string>(OP_KEYS)

type LiteralBuilder = { lit: (value: unknown) => unknown }

type Whereable<Q> = {
	where(column: string, op: string, value: unknown): Whereable<Q>
	where(factory: (eb: LiteralBuilder) => unknown): Whereable<Q>
}

const FALSE_FACTORY = (eb: LiteralBuilder) => eb.lit(false)

function isConditionObjectShape(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false
	if (Array.isArray(value)) return false
	if (value instanceof Date) return false
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return false
	const keys = Object.keys(value as Record<string, unknown>)
	if (keys.length === 0) return false
	for (const k of keys) if (!OP_KEY_SET.has(k)) return false
	return true
}

/**
 * Apply a WhereClause to a query builder in one pass.
 * Returns `[qb, empty]` where `empty === true` when the WHERE includes an
 * empty `in` array (`{ col: [] }` or `{ col: { in: [] } }`). Callers should
 * short-circuit on empty to skip the round-trip.
 */
export function applyWhere<Q>(qb: Q, where: Record<string, unknown>): [Q, boolean] {
	let q = qb as unknown as Whereable<Q>
	let empty = false
	for (const [key, value] of Object.entries(where)) {
		if (value === undefined) continue
		if (value === null) {
			q = q.where(key, 'is', null)
			continue
		}
		if (Array.isArray(value)) {
			if (value.length === 0) {
				q = q.where(FALSE_FACTORY)
				empty = true
			} else {
				q = q.where(key, 'in', value)
			}
			continue
		}
		if (isConditionObjectShape(value)) {
			for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
				if (op === 'in' && Array.isArray(opValue) && opValue.length === 0) {
					q = q.where(FALSE_FACTORY)
					empty = true
					continue
				}
				q = applyOperator(q, key, op as WhereOp, opValue)
			}
			continue
		}
		q = q.where(key, '=', value)
	}
	return [q as unknown as Q, empty]
}

function applyOperator<Q>(
	q: Whereable<Q>,
	key: string,
	op: WhereOp,
	value: unknown,
): Whereable<Q> {
	switch (op) {
		case 'eq':
			return value === null ? q.where(key, 'is', null) : q.where(key, '=', value)
		case 'ne':
			return value === null ? q.where(key, 'is not', null) : q.where(key, '!=', value)
		case 'gt':
			return q.where(key, '>', value)
		case 'gte':
			return q.where(key, '>=', value)
		case 'lt':
			return q.where(key, '<', value)
		case 'lte':
			return q.where(key, '<=', value)
		case 'like':
			return q.where(key, 'like', value)
		case 'ilike':
			return q.where(key, 'ilike', value)
		case 'in': {
			const arr = value as unknown[]
			if (arr.length === 0) {
				return q.where(FALSE_FACTORY)
			}
			return q.where(key, 'in', arr)
		}
		case 'notIn': {
			const arr = value as unknown[]
			if (arr.length === 0) return q
			return q.where(key, 'not in', arr)
		}
		case 'isNull':
			return q.where(key, 'is', null)
		case 'isNotNull':
			return q.where(key, 'is not', null)
	}
}

