import type { Cameras, GameObjects } from 'phaser'
import Effect from './Effect'
import { ensureEffectRegistered } from './installEffects'

type EffectClass<T extends Effect> = (new (camera: Cameras.Scene2D.Camera) => T) & {
    KEY: string
    FRAGMENT: string
}

/**
 * Convenience facade around `gameObject.filters.internal` for adding,
 * removing, and clearing reef effects.
 */
export default class EffectManager {

    private readonly target: GameObjects.GameObject

    constructor(target: GameObjects.GameObject) {
        this.target = target
    }

    private get filterList(): any {
        const t = this.target as any
        if (!t.filters && typeof t.enableFilters === 'function') {
            t.enableFilters()
        }
        if (!t.filters) {
            throw new Error('reef.effects: target has no filters list (Phaser 4 WebGL renderer required, and target must support enableFilters)')
        }
        return t.filters.internal
    }

    /**
     * Add an effect to the internal filter list. Optional `params` are
     * shallow-assigned onto the new instance for ergonomic configuration.
     */
    add<T extends Effect>(EffectClass: EffectClass<T>, params?: Partial<T>): T {
        const list = this.filterList
        const camera = list.camera as Cameras.Scene2D.Camera
        const game = (this.target as any).scene?.game ?? camera.scene?.game
        if (game) {
            const registered = ensureEffectRegistered(game, EffectClass)
            if (!registered) {
                throw new Error(`reef.effects: effect ${EffectClass.KEY} could not be registered (WebGL renderer not booted?)`)
            }
        }
        const effect = new EffectClass(camera)
        if (params) {
            for (const key of Object.keys(params) as Array<keyof T>) {
                (effect as any)[key] = (params as any)[key]
            }
        }
        list.add(effect as any)
        return effect
    }

    remove<T extends Effect>(effect: T): this {
        this.filterList.remove(effect as any)
        return this
    }

    /** Get the list of attached effects. */
    get list(): Effect[] {
        return this.filterList.list as Effect[]
    }

    /** Remove and destroy every attached effect. */
    clear(): this {
        this.filterList.clear()
        return this
    }

}
