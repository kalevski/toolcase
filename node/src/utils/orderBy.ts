export type OrderDirection = 'asc' | 'desc'

export type OrderNulls = 'first' | 'last'

export interface OrderByColumn<T> {
	column: keyof T & string
	direction?: OrderDirection
	nulls?: OrderNulls
}

export type OrderBy<T> = (keyof T & string) | OrderByColumn<T>

type OrderByable<Q> = {
	orderBy(column: string, direction: string): OrderByable<Q>
}

export function applyOrderBy<Q, T>(qb: Q, orderBy: OrderBy<T> | OrderBy<T>[]): Q {
	let q = qb as unknown as OrderByable<Q>
	const list = Array.isArray(orderBy) ? orderBy : [orderBy]
	for (const ord of list) {
		if (typeof ord === 'string') {
			q = q.orderBy(ord, 'asc')
			continue
		}
		const direction = ord.direction ?? 'asc'
		if (ord.nulls) {
			q = q.orderBy(ord.column, `${direction} nulls ${ord.nulls}`)
		} else {
			q = q.orderBy(ord.column, direction)
		}
	}
	return q as unknown as Q
}
