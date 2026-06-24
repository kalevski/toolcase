function truncate(input: string, maxLength: number, suffix: string = '…'): string {
    if (input.length <= maxLength) return input
    const cut = maxLength - suffix.length
    if (cut <= 0) return suffix.slice(0, maxLength)
    return input.slice(0, cut) + suffix
}

export default truncate
