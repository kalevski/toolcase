
/**
 * @template T
 * @callback CallbackFn
 * @returns {T | Promise<T>}
 */

/**
 * @typedef RetryOptions
 * @property {number} retries
 * @property {number} factor
 * @property {number} minTimeout
 * @property {number} maxTimeout
 * @property {boolean} randomize
 */

/**
 * @template T
 * @param {CallbackFn<T>} callbackFn 
 * @param {Partial<RetryOptions>} options
 * @returns {Promise<T>}
 */
const retry = async (callbackFn, options = {}) => {
    let {
        retries = 3,
        factor = 2,
        minTimeout = 1000,
        maxTimeout = Infinity,
        randomize = false
    } = options
    
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

/**
 * @template T
 * @param {CallbackFn<T>} callbackFn
 * @returns {Promise<T>}
 */
const wrapPromise = async (callbackFn) => {
    const output = callbackFn()
    if (output instanceof Promise) {
        return await output
    }
    return output
}

/**
 * 
 * @param {number} ms 
 * @returns {Promise<void>}
 */
const waitFor = (ms) => {
    return new Promise(resolve => setTimeout(() => resolve(), ms))
}

export default retry