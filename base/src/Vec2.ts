export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

class Vec2 {

    static readonly ZERO: Vec2 = new Vec2(0, 0)
    static readonly ONE: Vec2 = new Vec2(1, 1)

    readonly x: number
    readonly y: number

    constructor(x: number = 0, y: number = 0) {
        this.x = x
        this.y = y
    }

    add(other: Vec2): Vec2 {
        return new Vec2(this.x + other.x, this.y + other.y)
    }

    subtract(other: Vec2): Vec2 {
        return new Vec2(this.x - other.x, this.y - other.y)
    }

    scale(factor: number): Vec2 {
        return new Vec2(this.x * factor, this.y * factor)
    }

    dot(other: Vec2): number {
        return this.x * other.x + this.y * other.y
    }

    get length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    get lengthSq(): number {
        return this.x * this.x + this.y * this.y
    }

    normalize(): Vec2 {
        const len = this.length
        if (len === 0) return Vec2.ZERO
        return new Vec2(this.x / len, this.y / len)
    }

    lerp(other: Vec2, t: number): Vec2 {
        return new Vec2(
            this.x + (other.x - this.x) * t,
            this.y + (other.y - this.y) * t
        )
    }

    rotate(angle: number): Vec2 {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return new Vec2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        )
    }

    negate(): Vec2 {
        return new Vec2(this.x === 0 ? 0 : -this.x, this.y === 0 ? 0 : -this.y)
    }

    distanceTo(other: Vec2): number {
        const dx = this.x - other.x
        const dy = this.y - other.y
        return Math.sqrt(dx * dx + dy * dy)
    }

    equals(other: Vec2): boolean {
        return this.x === other.x && this.y === other.y
    }

    toArray(): [number, number] {
        return [this.x, this.y]
    }

    toString(): string {
        return `Vec2(${this.x}, ${this.y})`
    }

}

export default Vec2
