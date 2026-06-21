class Deferred<T> {

    private _resolve!: (value: T | PromiseLike<T>) => void

    private _reject!: (reason?: unknown) => void

    readonly promise: Promise<T>

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve
            this._reject = reject
        })
    }

    resolve(value: T): void {
        this._resolve(value)
    }

    reject(reason?: unknown): void {
        this._reject(reason)
    }

}

export default Deferred
