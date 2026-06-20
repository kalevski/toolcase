type AnyFn = (...args: any[]) => void

export interface ThrottleOptions {
    leading?: boolean
    trailing?: boolean
}

export default function throttle<T extends AnyFn>(fn: T, ms: number, options: ThrottleOptions = {}): T {
    const { leading = true, trailing = true } = options
    let last = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastArgs: Parameters<T> | null = null

    const invoke = (args: Parameters<T>): void => {
        last = Date.now()
        fn(...(args as any[]))
    }

    return ((...args: Parameters<T>): void => {
        const now = Date.now()
        if (last === 0 && !leading) last = now
        const elapsed = now - last
        if (elapsed >= ms) {
            if (timer !== null) {
                clearTimeout(timer)
                timer = null
            }
            invoke(args)
            return
        }
        if (!trailing) return
        lastArgs = args
        if (timer === null) {
            timer = setTimeout(() => {
                timer = null
                if (lastArgs !== null) {
                    const next = lastArgs
                    lastArgs = null
                    invoke(next)
                }
            }, Math.max(0, ms - elapsed))
        }
    }) as T
}
