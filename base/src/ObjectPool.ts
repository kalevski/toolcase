type ResetFn<T> = (object: T) => void
type InstanceFn<T> = (objectClass: new () => T) => T

class ObjectPool<T extends Record<string, any>> {

    private pool: T[] = []

    private objectClass: new () => T

    /** Cumulative count of instances ever created, not the current live count. */
    readonly instances: number = 0

    private resetFn: ResetFn<T> = () => {}

    private instanceFn: InstanceFn<T> = () => new this.objectClass()

    private inPool = new Set<T>()

    constructor(objectClass: new () => T, resetFn: ResetFn<T> | null = null, instanceFn: InstanceFn<T> | null = null) {
        this.objectClass = objectClass

        if (typeof resetFn === 'function') {
            this.resetFn = resetFn
        }

        if (typeof instanceFn === 'function') {
            this.instanceFn = instanceFn
        }
    }

    obtain(): T {
        if (this.pool.length === 0) {
            this.createInstance()
        }
        const object = this.pool.pop()!
        this.inPool.delete(object)
        return object
    }

    release = (object: T): this => {
        if (this.inPool.has(object)) return this
        this.resetFn(object)
        this.inPool.add(object)
        this.pool.push(object)
        return this
    }

    dispose(): void {
        this.pool = []
        this.inPool.clear()
    }

    private createInstance(): void {
        const object = this.instanceFn(this.objectClass) as any
        ;(this as any).instances++
        if (typeof object.release === 'undefined') {
            object.release = () => this.release(object)
        } else {
            throw new Error(`object ${JSON.stringify(object)} already has release function`)
        }
        this.inPool.add(object)
        this.pool.push(object)
    }
}

export default ObjectPool
