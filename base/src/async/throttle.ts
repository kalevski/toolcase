type ThrottleFn = (...args: any[]) => void

type ThrottledFn<T extends ThrottleFn> = ((...args: Parameters<T>) => void) & { cancel(): void }

function throttle<T extends ThrottleFn>(fn: T, ms: number): ThrottledFn<T> {
    if (typeof fn !== 'function') {
        throw new Error('fn must be a function')
    }
    if (ms < 0) {
        throw new Error('ms must be a non-negative number')
    }
    let lastCall = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastArgs: Parameters<T> | null = null
    let lastCtx: unknown = undefined

    function throttled(this: unknown, ...args: Parameters<T>): void {
        const now = Date.now()
        const remaining = ms - (now - lastCall)
        lastArgs = args
        lastCtx = this

        if (remaining <= 0 || remaining > ms) {
            if (timer !== null) {
                clearTimeout(timer)
                timer = null
            }
            lastCall = now
            fn.apply(this, args)
            lastArgs = null
            lastCtx = undefined
        } else if (timer === null) {
            timer = setTimeout(() => {
                lastCall = Date.now()
                timer = null
                if (lastArgs !== null) {
                    fn.apply(lastCtx, lastArgs)
                    lastArgs = null
                    lastCtx = undefined
                }
            }, remaining)
        }
    }

    throttled.cancel = function(): void {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
        lastCall = 0
        lastArgs = null
        lastCtx = undefined
    }

    return throttled as ThrottledFn<T>
}

export default throttle
