import { generateId } from '@toolcase/base'
import { Game, GameObjects, Math as M } from 'phaser'
import EffectManager from '../effects/EffectManager'
import type Scene from './Scene'

type Child = GameObjects.GameObject

export default class GameObject extends GameObjects.Container {

    declare scene: Scene

    protected readonly game: Game

    readonly id: string

    private readonly _abs: M.Vector2 = new M.Vector2(0, 0)

    private _effects: EffectManager | null = null

    constructor(scene: Scene, x: number, y: number) {
        super(scene as unknown as Phaser.Scene, x, y)
        this.scene = scene
        this.game = scene.game
        this.id = generateId(16)
    }

    /**
     * Effect manager for this game object. Wraps `filters.internal` and lets
     * you `add`/`remove`/`clear` reef shader effects.
     */
    get effects(): EffectManager {
        if (this._effects === null) this._effects = new EffectManager(this as unknown as GameObjects.GameObject)
        return this._effects
    }

    /**
     * Cached world-space position (re-computed on every read of `absolute`).
     * Prefer `getAbsolute(out)` when you need a stable copy.
     */
    get absolute(): M.Vector2 {
        return this.getAbsolute(this._abs)
    }

    /**
     * Compute world-space position by walking up the parentContainer chain.
     */
    getAbsolute(out: M.Vector2 = new M.Vector2()): M.Vector2 {
        out.set(this.x, this.y)
        let parent: any = this.parentContainer
        while (parent instanceof GameObjects.GameObject) {
            const p = parent as any
            out.x += p.x
            out.y += p.y
            parent = p.parentContainer
        }
        return out
    }

    onCreate(): void {}

    onAdd(_parent: GameObjects.GameObject): void {}

    onUpdate(_time: number, _delta: number): void {}

    onRemove(_parent: GameObjects.GameObject): void {}

    onDestroy(): void {}

    protected preDestroy(): void {
        this._effects?.clear()
        this._effects = null
        super.preDestroy()
        this.onDestroy()
    }

    override add(child: Child | Child[]): this {
        super.add(child as any)
        if (Array.isArray(child)) {
            for (const entity of child) {
                if (entity instanceof GameObject) entity.onAdd(this as any)
            }
        } else if (child instanceof GameObject) {
            child.onAdd(this as any)
        }
        return this
    }

    override remove(child: Child | Child[], destroyChild: boolean = false): this {
        if (Array.isArray(child)) {
            for (const entity of child) {
                if (entity instanceof GameObject) entity.onRemove(this as any)
            }
        } else if (child instanceof GameObject) {
            child.onRemove(this as any)
        }
        return super.remove(child as any, destroyChild) as this
    }

    override removeAll(destroyChild: boolean = false): this {
        for (const child of this.list) {
            if (child instanceof GameObject) child.onRemove(this as any)
        }
        return super.removeAll(destroyChild) as this
    }

    /** @internal */
    doUpdate(time: number, delta: number): void {
        this.onUpdate(time, delta)
        for (const child of this.list) {
            if (child instanceof GameObject) child.doUpdate(time, delta)
        }
    }

}
