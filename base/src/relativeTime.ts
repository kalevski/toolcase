function relativeTime(date: Date | number): string {
    const now = Date.now()
    const target = typeof date === 'number' ? date : date.getTime()
    const diffMs = target - now
    const abs = Math.abs(diffMs)
    const past = diffMs < 0

    if (abs < 1000) return 'just now'

    const seconds = Math.round(abs / 1000)
    if (seconds < 60) return label(seconds, 'second', past)

    const minutes = Math.round(abs / 60_000)
    if (minutes < 60) return label(minutes, 'minute', past)

    const hours = Math.round(abs / 3_600_000)
    if (hours < 24) return label(hours, 'hour', past)

    const days = Math.round(abs / 86_400_000)
    return label(days, 'day', past)
}

function label(n: number, unit: string, past: boolean): string {
    const text = n === 1 ? `1 ${unit}` : `${n} ${unit}s`
    return past ? `${text} ago` : `in ${text}`
}

export default relativeTime
