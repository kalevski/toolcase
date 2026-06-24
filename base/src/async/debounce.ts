type DebounceFn = (...args: any[]) => void

type DebouncedFn<T extends DebounceFn> = ((...args: Parameters<T>) => void) & { cancel(): void }

function debounce<T extends DebounceFn>(fn: T, ms: number): DebouncedFn<T> {
    if (typeof fn !== 'function') {
        throw new Error('fn must be a function')
    }
    if (ms < 0) {
        throw new Error('ms must be a non-negative number')
    }
    let timer: ReturnType<typeof setTimeout> | null = null

    function debounced(this: unknown, ...args: Parameters<T>): void {
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = null
            fn.apply(this, args)
        }, ms)
    }

    debounced.cancel = function(): void {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    return debounced as DebouncedFn<T>
}

export default debounce
