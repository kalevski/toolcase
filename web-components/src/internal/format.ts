// Shared number-formatting helpers for string-rendered markup.

// Compact notation: 1234 → "1.2K", 1_000_000 → "1M".
// Built once — Intl formatter construction is expensive.
const compactFormatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
})

export function formatCompact(n: number): string {
    return compactFormatter.format(n)
}

// Rounded integer with thousands separators: 1234.6 → "1,235".
export function formatNumber(value: number): string {
    return Math.round(value).toLocaleString()
}
