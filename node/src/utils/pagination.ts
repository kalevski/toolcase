import { ValidationError } from '../errors'

export const DEFAULT_OFFSET = 0
export const DEFAULT_LIMIT = 25
export const DEFAULT_MAX_LIMIT = 1000

export type PaginationInput = {
	offset?: number
	limit?: number
}

export interface PaginationOptions {
	defaultLimit?: number
	maxLimit?: number
	strict?: boolean
}

export interface PageInfo {
	offset: number
	limit: number
	count: number
}

export interface Page<T> {
	results: T[]
	pagination: PageInfo
}

export interface OffsetLimit {
	offset: number
	limit: number
}

export interface CursorParams {
	limit?: number
	cursor?: string | null
}

export interface CursorPage<T> {
	results: T[]
	nextCursor: string | null
	hasMore: boolean
}

const clampLimit = (raw: unknown, opts: PaginationOptions): number => {
	const defaultLimit = opts.defaultLimit ?? DEFAULT_LIMIT
	const maxLimit = opts.maxLimit ?? DEFAULT_MAX_LIMIT
	if (raw === undefined || raw === null || raw === '') return defaultLimit
	const n = Number(raw)
	if (!Number.isFinite(n) || n <= 0) {
		if (opts.strict) throw new ValidationError(`Invalid limit: ${String(raw)}`)
		return defaultLimit
	}
	return Math.min(Math.floor(n), maxLimit)
}

const clampOffset = (raw: unknown, opts: PaginationOptions): number => {
	if (raw === undefined || raw === null || raw === '') return DEFAULT_OFFSET
	const n = Number(raw)
	if (!Number.isFinite(n) || n < 0) {
		if (opts.strict) throw new ValidationError(`Invalid offset: ${String(raw)}`)
		return DEFAULT_OFFSET
	}
	return Math.floor(n)
}

export function normalizeOffsetLimit(
	params: PaginationInput = {},
	opts: PaginationOptions = {},
): OffsetLimit {
	return {
		offset: clampOffset(params.offset, opts),
		limit: clampLimit(params.limit, opts),
	}
}

export function buildPage<T>(
	results: T[],
	count: number,
	offset: number,
	limit: number,
): Page<T> {
	return {
		results,
		pagination: { offset, limit, count },
	}
}
