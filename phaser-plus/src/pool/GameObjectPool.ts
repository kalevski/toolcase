import { ObjectPool } from '@toolcase/base'
import type { Logger } from '@toolcase/logging'
import GameObject from '../engine/GameObject'
import type Scene from '../engine/Scene'

type GameObjectClass<T extends GameObject> = new (scene: Scene, ...rest: any[]) => T

type InstanceFn<T extends GameObject> = (key: string, gameObjectClass: GameObjectClass<T>, scene: Scene) => T

type ResetFn<T extends GameObject> = (gameObject: T) => void

interface Poolable {
    poolable?: boolean
    onCreate?(): void
    release?(): void
}

export default class GameObjectPool {

    private readonly scene: Scene

    private readonly logger: Logger

    private readonly map: Map<string, ObjectPool<any>> = new Map()

    private cachedKeys: string[] = []

    private dirty: boolean = false

    constructor(scene: Scene) {
        this.scene = scene
        this.logger = scene.engine.getLogger('pool')
    }

    get keys(): string[] {
        if (!this.dirty) return this.cachedKeys
        this.cachedKeys = Array.from(this.map.keys())
        this.dirty = false
        return this.cachedKeys
    }

    get instances(): number {
        let total = 0
        this.map.forEach(pool => { total += (pool as any).instances })
        return total
    }

    has(key: string): boolean {
        return this.map.has(key)
    }

    /** Number of live instances for a single registered key. */
    count(key: string): number {
        const pool = this.map.get(key)
        return pool ? (pool as any).instances : 0
    }

    register<T extends GameObject>(
        key: string,
        gameObjectClass: GameObjectClass<T>,
        instanceFn: InstanceFn<T> | null = null,
        resetFn: ResetFn<T> | null = null
    ): this {
        if (this.map.has(key)) {
            this.logger.error(`game object ${key} is already registered`)
            return this
        }

        const factory: InstanceFn<T> = instanceFn ?? this.defaultInstance.bind(this)
        const pool = new (ObjectPool as any)(
            gameObjectClass,
            resetFn,
            (cls: GameObjectClass<T>) => factory(key, cls, this.scene)
        )
        this.map.set(key, pool)
        this.dirty = true
        return this
    }

    obtain<T extends GameObject>(key: string): T | null {
        const pool = this.map.get(key)
        if (!pool) {
            this.logger.error(`game object ${key} is not registered`)
            return null
        }
        const object = pool.obtain() as T & Poolable
        this.onObjectCreate(object)
        return object as T
    }

    release<T extends GameObject>(object: T & Poolable): this {
        if (typeof object.release !== 'function') {
            this.logger.warning('cannot be released, the object was not created by the pool', object)
            return this
        }
        object.release()
        return this
    }

    dispose(): void {
        this.map.forEach(pool => { (pool as any).dispose() })
        this.map.clear()
        this.dirty = true
    }

    private defaultInstance<T extends GameObject>(_key: string, gameObjectClass: GameObjectClass<T>, scene: Scene): T {
        return new gameObjectClass(scene)
    }

    private onObjectCreate(object: Poolable): void {
        if (typeof object.poolable === 'boolean') return
        object.poolable = true
        if (typeof object.onCreate === 'function') {
            object.onCreate()
        }
    }

}
