import Algorithm from './Algorithm'
import { AlgorithmOptions, PlacedRect, Rect, Size } from './types'

interface BTNode {
    rect: Rect
    used: boolean
    right: BTNode | null
    down: BTNode | null
}

class BinaryTree extends Algorithm {

    private root: BTNode | null = null

    private usedArea: number = 0

    private maxX: number = 0

    private maxY: number = 0

    constructor(options: AlgorithmOptions) {
        super(options)
    }

    insert(size: Size): PlacedRect | null {
        const w = size.width
        const h = size.height
        if (w <= 0 || h <= 0) return null
        if (w > this.width && (!this.allowRotation || h > this.width)) return null
        if (h > this.height && (!this.allowRotation || w > this.height)) return null

        if (this.root === null) {
            this.root = { rect: { x: 0, y: 0, width: this.width, height: this.height }, used: false, right: null, down: null }
        }

        const attempts: { w: number, h: number, rotated: boolean }[] = [{ w, h, rotated: false }]
        if (this.allowRotation && w !== h) attempts.push({ w: h, h: w, rotated: true })

        for (const a of attempts) {
            const node = this.find(this.root, a.w, a.h)
            if (node !== null) {
                const placed = this.split(node, a.w, a.h)
                this.usedArea += a.w * a.h
                const right = placed.rect.x + a.w
                const bottom = placed.rect.y + a.h
                if (right > this.maxX) this.maxX = right
                if (bottom > this.maxY) this.maxY = bottom
                return { x: placed.rect.x, y: placed.rect.y, width: a.w, height: a.h, rotated: a.rotated }
            }
        }
        return null
    }

    reset(): void {
        this.root = null
        this.usedArea = 0
        this.maxX = 0
        this.maxY = 0
    }

    occupancy(): number {
        const total = this.width * this.height
        return total === 0 ? 0 : this.usedArea / total
    }

    usedBounds(): Size {
        return { width: this.maxX, height: this.maxY }
    }

    private find(node: BTNode, w: number, h: number): BTNode | null {
        const stack: BTNode[] = [node]
        while (stack.length > 0) {
            const current = stack.pop()!
            if (current.used) {
                if (current.down !== null) stack.push(current.down)
                if (current.right !== null) stack.push(current.right)
                continue
            }
            if (w <= current.rect.width && h <= current.rect.height) return current
        }
        return null
    }

    private split(node: BTNode, w: number, h: number): BTNode {
        node.used = true
        node.right = {
            rect: { x: node.rect.x + w, y: node.rect.y, width: node.rect.width - w, height: h },
            used: false,
            right: null,
            down: null
        }
        node.down = {
            rect: { x: node.rect.x, y: node.rect.y + h, width: node.rect.width, height: node.rect.height - h },
            used: false,
            right: null,
            down: null
        }
        return node
    }

}

export default BinaryTree
