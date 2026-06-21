import { ValidationError } from '../errors'
import { Sort } from './sort'

export interface ParseSortOptions<T extends object> {
	allowedFields?: ReadonlyArray<keyof T & string>
}

export function parseSort<T extends object = Record<string, unknown>>(
	query: Record<string, unknown>,
	options: ParseSortOptions<T> = {},
): Sort<T>[] | undefined {
	if (options.allowedFields === undefined) {
		throw new Error('parseSort: pass allowedFields; [] to allow none')
	}
	const raw = query.sort
	if (raw === undefined || raw === null || raw === '') return undefined
	if (typeof raw !== 'string') {
		throw new ValidationError(`Invalid sort: ${String(raw)}`)
	}
	const allowed = new Set<string>(options.allowedFields)
	const out: Sort<T>[] = []
	for (const tokenRaw of raw.split(',')) {
		const token = tokenRaw.trim()
		if (token === '') continue
		let direction: 'asc' | 'desc' = 'asc'
		let column = token
		if (token.startsWith('-')) {
			direction = 'desc'
			column = token.slice(1).trim()
		} else if (token.startsWith('+')) {
			column = token.slice(1).trim()
		}
		if (column === '') {
			throw new ValidationError(`Invalid sort token: ${tokenRaw}`)
		}
		if (!allowed.has(column)) {
			throw new ValidationError(`Unknown sort field: ${column}`)
		}
		out.push({ field: column as keyof T & string, direction })
	}
	if (out.length === 0) return undefined
	return out
}
