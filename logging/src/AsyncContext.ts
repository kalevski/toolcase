import { AsyncLocalStorage } from 'node:async_hooks'

class AsyncContext {

    private storage: AsyncLocalStorage<Record<string, any>>

    constructor() {
        this.storage = new AsyncLocalStorage()
    }

    run<T>(fields: Record<string, any>, fn: () => T): T {
        const parent = this.storage.getStore() ?? {}
        return this.storage.run({ ...parent, ...fields }, fn)
    }

    getFields(): Record<string, any> {
        return this.storage.getStore() ?? {}
    }

}

export default AsyncContext
