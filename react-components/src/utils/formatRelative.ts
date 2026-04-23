/**
 * Format a date as a human-friendly relative time, e.g. "3 days ago" or
 * "in 5 minutes". Presentational helper — does not know about any specific
 * domain. Uses `Intl.RelativeTimeFormat` when available.
 */
export function formatRelative(input: string | number | Date, now: Date = new Date()): string {
	const date = input instanceof Date ? input : new Date(input)
	const diffSec = (date.getTime() - now.getTime()) / 1000
	const abs = Math.abs(diffSec)

	const table: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
		{ limit: 60, divisor: 1, unit: 'second' },
		{ limit: 3600, divisor: 60, unit: 'minute' },
		{ limit: 86400, divisor: 3600, unit: 'hour' },
		{ limit: 604800, divisor: 86400, unit: 'day' },
		{ limit: 2592000, divisor: 604800, unit: 'week' },
		{ limit: 31536000, divisor: 2592000, unit: 'month' },
		{ limit: Infinity, divisor: 31536000, unit: 'year' },
	]

	const row = table.find((r) => abs < r.limit) ?? table[table.length - 1]
	const value = Math.round(diffSec / row.divisor)

	const rtf =
		typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
			? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
			: null

	if (rtf) return rtf.format(value, row.unit)
	const past = value < 0
	const n = Math.abs(value)
	const plural = n === 1 ? '' : 's'
	return past ? `${n} ${row.unit}${plural} ago` : `in ${n} ${row.unit}${plural}`
}
