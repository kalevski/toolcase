export interface RetryOptions {
    retries: number
    factor: number
    minTimeout: number
    maxTimeout: number
    randomize: boolean
}

const retry = async <T>(callbackFn: () => T | Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> => {
    const {
        retries = 3,
        minTimeout = 1000,
        maxTimeout = Infinity,
        randomize = false
    } = options

    let factor = options.factor ?? 2
    
    if (factor < 1) {
        factor = 1
    }

    if (minTimeout > maxTimeout) {
        throw new Error(`minTimeout=(${minTimeout}) can not be greater then maxTimeout=(${maxTimeout})`)
    }
    
    let attempt = 0
    while(true) {
        const random = randomize ? Math.random() + 1 : 1
        const timeout = Math.min(random * minTimeout * Math.pow(factor, attempt - 1), maxTimeout)
        if (attempt > 0) {
            await waitFor(timeout)
        }
        try {
            const result = await wrapPromise(callbackFn)
            return result
        } catch (error) {
            if (attempt >= retries) {
                throw error
            }
            attempt++
        }
    }
}

const wrapPromise = async <T>(callbackFn: () => T | Promise<T>): Promise<T> => {
    const output = callbackFn()
    if (output instanceof Promise) {
        return await output
    }
    return output
}

const waitFor = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(() => resolve(), ms))
}

export default retry
