import Semaphore from './Semaphore'

function pLimit(concurrency: number): <T>(fn: () => T | Promise<T>) => Promise<T> {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new Error('concurrency must be a positive integer')
    }
    const semaphore = new Semaphore(concurrency)
    return fn => semaphore.run(fn)
}

export default pLimit
