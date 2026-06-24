import { Math as M } from 'phaser'
import type Scene from '../engine/Scene'
import GameObject from '../engine/GameObject'
import type World from './World'

export default class GameObject2D extends GameObject {

    private readonly context: World

    transform: M.Vector2 = new M.Vector2(0, 0)

    pivot: M.Vector2 = new M.Vector2(0, 0)

    constructor(scene: Scene, context: World) {
        super(scene, 0, 0)
        this.context = context
    }

    get projection() {
        return this.context.projection
    }

    setTransform(x: number, y: number): this {
        this.projection.transformPoint(x, y, this as unknown as M.Vector2)
        this.transform.set(x, y)
        this.pivot.set(x, y)
        return this
    }

    setTransformX(x: number): this {
        return this.setTransform(x, this.transform.y)
    }

    setTransformY(y: number): this {
        return this.setTransform(this.transform.x, y)
    }

    addTag(_tag: string): this {
        return this
    }

    removeTag(_tag: string): this {
        return this
    }

    removeTags(): void {}

    override doUpdate(time: number, delta: number): void {
        super.doUpdate(time, delta)
        this.projection.inverse.transformPoint(this.x, this.y, this.transform)
        this.pivot.set(this.transform.x, this.transform.y)
    }

}
