function potCeil(value: number): number {
    if (value <= 1) return 1
    return 1 << (32 - Math.clz32(value - 1))
}

export default potCeil
