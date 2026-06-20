import { Broadcast } from '@toolcase/base'
import Feature from './Feature'
import type Scene from '../engine/Scene'

type FeatureClass<T extends Feature> = new (scene: Scene, key: string) => T

export default class FeatureRegistry extends Broadcast {

    private readonly scene: Scene

    private readonly features: Map<string, Feature> = new Map()

    private featureKeys: string[] = []

    private dirty: boolean = false

    constructor(scene: Scene) {
        super()
        this.scene = scene
    }

    get keys(): string[] {
        if (!this.dirty) return this.featureKeys
        this.featureKeys = Array.from(this.features.keys())
        this.dirty = false
        return this.featureKeys
    }

    get size(): number {
        return this.features.size
    }

    /**
     * Features are constructed and `onCreate`-called eagerly in registration order.
     * A feature may only `get()` dependencies that were registered before it.
     */
    register<T extends Feature>(key: string, featureClass: FeatureClass<T>): T {
        if (this.features.has(key)) {
            throw new Error(`key ${key} is already in use by other feature`)
        }
        if (typeof featureClass !== 'function') {
            throw new Error(`featureClass provided [${featureClass}] is not a class`)
        }
        const feature = new featureClass(this.scene, key)
        if (!(feature instanceof Feature)) {
            throw new Error(`featureClass must extend Feature class`)
        }
        feature.onCreate()
        this.features.set(key, feature)
        this.dirty = true
        return feature
    }

    get<T extends Feature>(key: string): T | null {
        return (this.features.get(key) as T | undefined) ?? null
    }

    has(key: string): boolean {
        return this.features.has(key)
    }

    destroy(key: string): void {
        const feature = this.get(key)
        if (feature === null) return
        feature.preDestroy()
        feature.onDestroy()
        this.features.delete(key)
        this.dirty = true
    }

    destroyAll(): void {
        for (const key of [...this.keys].reverse()) {
            this.destroy(key)
        }
    }

    /** @internal */
    doUpdate(time: number, delta: number): void {
        for (const key of this.keys) {
            this.get(key)!.onUpdate(time, delta)
        }
    }

    /** @internal */
    public override emit(event: string, ...messages: any[]): boolean {
        return super.emit(event, ...messages)
    }

    /** @internal */
    public listenerCount(event?: string): number {
        return super.listenerCount(event)
    }

}
