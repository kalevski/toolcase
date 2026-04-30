import type { GameObjects } from 'phaser'
import ProxyHandler from './ProxyHandler'

type AnyGameObject = GameObjects.GameObject & {
    x?: number
    y?: number
    setX?(v: number): unknown
    setY?(v: number): unknown
    scaleX?: number
    scaleY?: number
    setScale?(x: number, y: number): unknown
    visible?: boolean
    setVisible?(v: boolean): unknown
    alpha?: number
    setAlpha?(v: number): unknown
    angle?: number
    setAngle?(v: number): unknown
    transform?: { x: number, y: number }
    setTransformX?(v: number): unknown
    setTransformY?(v: number): unknown
    id?: string
    name?: string
    type?: string
}

class GameObjectPosition extends ProxyHandler<AnyGameObject> {
    get x(): number { return this.ref?.x ?? 0 }
    set x(value: number) { this.ref?.setX?.(value) }
    get y(): number { return this.ref?.y ?? 0 }
    set y(value: number) { this.ref?.setY?.(value) }
}

class GameObjectScale extends ProxyHandler<AnyGameObject> {
    get x(): number { return this.ref?.scaleX ?? 0 }
    set x(value: number) {
        if (this.ref) this.ref.setScale?.(value, this.ref.scaleX ?? value)
    }
    get y(): number { return this.ref?.scaleY ?? 0 }
    set y(value: number) {
        if (this.ref) this.ref.setScale?.(this.ref.scaleX ?? value, value)
    }
}

class GameObjectTransform extends ProxyHandler<AnyGameObject> {
    get x(): number { return this.ref?.transform?.x ?? 0 }
    set x(value: number) {
        if (this.ref?.transform !== undefined) this.ref.setTransformX?.(value)
    }
    get y(): number { return this.ref?.transform?.y ?? 0 }
    set y(value: number) {
        if (this.ref?.transform !== undefined) this.ref.setTransformY?.(value)
    }
}

export default class GameObjectHandler extends ProxyHandler<AnyGameObject> {

    position: GameObjectPosition = new GameObjectPosition()

    transform: GameObjectTransform = new GameObjectTransform()

    scale: GameObjectScale = new GameObjectScale()

    protected proxyList: ProxyHandler<AnyGameObject>[] = [this.position, this.transform, this.scale]

    get id(): string { return this.ref?.id ?? 'N/A' }
    get name(): string { return this.ref?.name ?? 'N/A' }
    get type(): string { return this.ref?.type ?? 'N/A' }

    get visible(): boolean { return this.ref?.visible ?? false }
    set visible(value: boolean) { this.ref?.setVisible?.(value) }

    get alpha(): number { return this.ref?.alpha ?? 1 }
    set alpha(value: number) { this.ref?.setAlpha?.(value) }

    get angle(): number { return this.ref?.angle ?? 0 }
    set angle(value: number) { this.ref?.setAngle?.(value) }

}
