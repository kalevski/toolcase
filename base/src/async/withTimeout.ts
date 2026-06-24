function withTimeout<T>(fn: () => T | Promise<T>, ms: number): Promise<T> {
    if (ms <= 0) {
        throw new Error('ms must be greater than 0')
    }
    return new Promise<T>((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true
                reject(new Error(`timed out after ${ms}ms`))
            }
        }, ms)
        Promise.resolve().then(() => fn()).then(
            value => {
                if (!settled) {
                    settled = true
                    clearTimeout(timer)
                    resolve(value)
                }
            },
            err => {
                if (!settled) {
                    settled = true
                    clearTimeout(timer)
                    reject(err)
                }
            }
        )
    })
}

export default withTimeout
