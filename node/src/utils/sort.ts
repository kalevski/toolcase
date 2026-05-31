export type SortDirection = 'asc' | 'desc'

export type SortNulls = 'first' | 'last'

export interface SortField<T> {
    field: keyof T & string
    direction?: SortDirection
    nulls?: SortNulls
}

/**
 * Engine-neutral description of a sort — a field name (ascending) or a `{ field, direction,
 * nulls }` object, or an array of either. Translating it into a concrete ordering is the
 * responsibility of a `BaseRepository` subclass.
 */
export type Sort<T> = (keyof T & string) | SortField<T>
