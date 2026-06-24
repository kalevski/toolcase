export interface FormatNumberOptions {
    compact?: boolean
}

function formatNumber(n: number, options: FormatNumberOptions = {}): string {
    if (!Number.isFinite(n)) return '0'

    if (options.compact) {
        const abs = Math.abs(n)
        const sign = n < 0 ? '-' : ''

        if (abs >= 1_000_000_000) {
            return `${sign}${trimZero((abs / 1_000_000_000).toFixed(1))}B`
        }
        if (abs >= 1_000_000) {
            return `${sign}${trimZero((abs / 1_000_000).toFixed(1))}M`
        }
        if (abs >= 1_000) {
            return `${sign}${trimZero((abs / 1_000).toFixed(1))}k`
        }
        return `${sign}${abs}`
    }

    const [int, dec] = String(n).split('.')
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return dec !== undefined ? `${grouped}.${dec}` : grouped
}

function trimZero(s: string): string {
    return s.endsWith('.0') ? s.slice(0, -2) : s
}

export default formatNumber
