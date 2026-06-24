export default class Transform {
    x: number = 0
    y: number = 0
    rotation: number = 0
    scaleX: number = 1
    scaleY: number = 1

    set(x: number, y: number, rotation = 0, scaleX = 1, scaleY = 1): this {
        this.x = x
        this.y = y
        this.rotation = rotation
        this.scaleX = scaleX
        this.scaleY = scaleY
        return this
    }

    reset(): this {
        return this.set(0, 0, 0, 1, 1)
    }

    copyFrom(other: Transform): this {
        return this.set(other.x, other.y, other.rotation, other.scaleX, other.scaleY)
    }

    clone(): Transform {
        return new Transform().copyFrom(this)
    }

    applyTo(target: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }): this {
        target.x = this.x
        target.y = this.y
        target.rotation = this.rotation
        target.scaleX = this.scaleX
        target.scaleY = this.scaleY
        return this
    }
}
