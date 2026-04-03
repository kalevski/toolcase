type ResetFn<T> = (object: T) => void
type InstanceFn<T> = (objectClass: new () => T) => T

class ObjectPool<T extends Record<string, any>> {

    private pool: T[] = []

    private objectClass: new () => T

    readonly instances: number = 0

    private resetFn: ResetFn<T> = () => {}

    private instanceFn: InstanceFn<T> = () => new this.objectClass()

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
        return object
    }

    release = (object: T): this => {
        this.resetFn(object)
        this.pool.push(object)
        return this
    }

    dispose(): void {
        this.pool = []
    }

    private createInstance(): void {
        const object = this.instanceFn(this.objectClass) as any
        ;(this as any).instances++
        if (typeof object.release === 'undefined') {
            object.release = () => this.release(object)
        } else {
            throw new Error(`object ${JSON.stringify(object)} already has release function`)
        }
        this.pool.push(object)
    }
}

export default ObjectPool
