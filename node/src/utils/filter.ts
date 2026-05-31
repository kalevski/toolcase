const FILTER_OPS = [
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

export type FilterOp = typeof FILTER_OPS[number]

export type FilterCondition<V> =
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

export type FilterMultiCondition<V> = {
    [K in FilterOp]?: K extends 'in' | 'notIn'
        ? NonNullable<V>[]
        : K extends 'isNull' | 'isNotNull'
            ? true
            : K extends 'like' | 'ilike'
                ? string
                : V
}

export type FilterValue<V> = V | V[] | null | FilterCondition<V> | FilterMultiCondition<V>

/**
 * Engine-neutral description of a filter — a map of field → value / condition. It describes
 * *intent* only; translating it into a concrete query (SQL predicate, Mongo filter, key scan)
 * is the responsibility of a `BaseRepository` subclass.
 */
export type Filter<T> = {
    [K in keyof T]?: FilterValue<T[K]>
}

/** The recognized filter operator keys. Useful for validating/translating a `Filter`. */
export const FILTER_OP_SET = new Set<string>(FILTER_OPS)
