export type EaseFn = (t: number) => number

const c1 = 1.70158
const c2 = c1 * 1.525

function bounceOut(t: number): number {
    if (t < 1 / 2.75) return 7.5625 * t * t
    if (t < 2 / 2.75) { const n = t - 1.5 / 2.75; return 7.5625 * n * n + 0.75 }
    if (t < 2.5 / 2.75) { const n = t - 2.25 / 2.75; return 7.5625 * n * n + 0.9375 }
    const n = t - 2.625 / 2.75; return 7.5625 * n * n + 0.984375
}

export const EASE: Record<string, EaseFn> = {
    linear:          t => t,
    easeIn:          t => t * t,
    easeOut:         t => t * (2 - t),
    easeInOut:       t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic:     t => t * t * t,
    easeOutCubic:    t => { const n = t - 1; return n * n * n + 1 },
    easeInOutCubic:  t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeInBack:      t => (c1 + 1) * t * t * t - c1 * t * t,
    easeOutBack:     t => { const n = t - 1; return 1 + (c1 + 1) * n * n * n + c1 * n * n },
    easeInOutBack:   t => t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2,
    bounce:          bounceOut,
    bounceIn:        t => 1 - bounceOut(1 - t),
    bounceOut,
    elastic:         t => {
        if (t === 0 || t === 1) return t
        return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI)
    }
}

export function resolveEase(ease: EaseFn | string | undefined): EaseFn {
    if (typeof ease === 'function') return ease
    if (typeof ease === 'string') {
        const fn = EASE[ease]
        if (fn === undefined) throw new Error(`Unknown easing "${ease}". Known: ${Object.keys(EASE).join(', ')}`)
        return fn
    }
    return EASE.linear
}
