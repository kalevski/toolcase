export default class AABB {
    x: number
    y: number
    width: number
    height: number

    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }

    get left(): number { return this.x }
    get right(): number { return this.x + this.width }
    get top(): number { return this.y }
    get bottom(): number { return this.y + this.height }
    get centerX(): number { return this.x + this.width * 0.5 }
    get centerY(): number { return this.y + this.height * 0.5 }

    set(x: number, y: number, width: number, height: number): this {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
        return this
    }

    reset(): this {
        return this.set(0, 0, 0, 0)
    }

    contains(px: number, py: number): boolean {
        return px >= this.left && px <= this.right && py >= this.top && py <= this.bottom
    }

    intersects(other: AABB): boolean {
        return !(
            other.right < this.left ||
            other.left > this.right ||
            other.bottom < this.top ||
            other.top > this.bottom
        )
    }

    containsRect(other: AABB): boolean {
        return other.left >= this.left && other.right <= this.right &&
            other.top >= this.top && other.bottom <= this.bottom
    }

    copyFrom(other: AABB): this {
        return this.set(other.x, other.y, other.width, other.height)
    }

    clone(): AABB {
        return new AABB(this.x, this.y, this.width, this.height)
    }

    static from(rect: { x: number; y: number; width: number; height: number }): AABB {
        return new AABB(rect.x, rect.y, rect.width, rect.height)
    }

    static fromCenter(cx: number, cy: number, width: number, height: number): AABB {
        return new AABB(cx - width * 0.5, cy - height * 0.5, width, height)
    }
}
