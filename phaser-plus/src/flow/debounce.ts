type AnyFn = (...args: any[]) => void

export interface DebounceOptions {
    leading?: boolean
}

export default function debounce<T extends AnyFn>(fn: T, ms: number, options: DebounceOptions = {}): T {
    const { leading = false } = options
    let timer: ReturnType<typeof setTimeout> | null = null

    return ((...args: Parameters<T>): void => {
        const callNow = leading && timer === null
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = null
            if (!leading) fn(...(args as any[]))
        }, ms)
        if (callNow) fn(...(args as any[]))
    }) as T
}
