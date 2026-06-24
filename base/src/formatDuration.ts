function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '0ms'

    if (ms < 1000) return `${Math.floor(ms)}ms`

    const totalSeconds = Math.floor(ms / 1000)
    if (totalSeconds < 60) return `${totalSeconds}s`

    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`

    const days = Math.floor(hours / 24)
    const hrs = hours % 24
    return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`
}

export default formatDuration
