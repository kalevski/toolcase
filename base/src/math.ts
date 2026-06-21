function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function inverseLerp(a: number, b: number, value: number): number {
    if (a === b) return 0
    return (value - a) / (b - a)
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

function approximately(a: number, b: number, epsilon: number = 1e-7): boolean {
    return Math.abs(a - b) <= epsilon
}

export { clamp, lerp, inverseLerp, mapRange, smoothstep, approximately }
