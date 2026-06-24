type AnyFn = (...args: any[]) => void

export interface DebounceOptions {
    leading?: boolean
    trailing?: boolean
}

export default function debounce<T extends AnyFn>(fn: T, ms: number, options: DebounceOptions = {}): T {
    const { leading = false, trailing = true } = options
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastArgs: Parameters<T> | null = null
    let calledThisWindow = false

    return ((...args: Parameters<T>): void => {
        const callNow = leading && timer === null
        lastArgs = args
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = null
            if (trailing && (!leading || calledThisWindow) && lastArgs !== null) {
                fn(...(lastArgs as any[]))
            }
            lastArgs = null
            calledThisWindow = false
        }, ms)
        if (callNow) { fn(...(args as any[])) } else { calledThisWindow = true }
    }) as T
}
