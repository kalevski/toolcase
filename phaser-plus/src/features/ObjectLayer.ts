import GameObject from '../engine/GameObject'
import Layer from './Layer'

export default class ObjectLayer extends Layer {

    add<T extends GameObject>(key: string, x: number, y: number): T {
        const object = this.scene.pool.obtain<T>(key)
        if (object === null) {
            throw new Error(`pool key=${key} is not registered`)
        }
        object.setPosition(x, y)
        this.container.add(object as any)
        return object
    }

    remove<T extends GameObject>(object: T): this {
        this.container.remove(object as any)
        this.scene.pool.release(object)
        return this
    }

    /**
     * Release every child back to the pool.
     */
    override clear(): this {
        const children = this.container.list.slice() as unknown as GameObject[]
        for (const child of children) {
            this.remove(child)
        }
        return this
    }

}
