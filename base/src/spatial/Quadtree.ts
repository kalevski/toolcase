import type { SpatialPoint, SpatialRect } from './types'

function overlaps(a: SpatialRect, b: SpatialRect): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y
}

function pointRectDist(p: SpatialPoint, r: SpatialRect): number {
    const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width))
    const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height))
    return Math.sqrt(dx * dx + dy * dy)
}

type QEntry<T> = { item: T; bounds: SpatialRect }

type QNode<T> = {
    bounds: SpatialRect
    entries: QEntry<T>[]
    depth: number
    nw: QNode<T> | null
    ne: QNode<T> | null
    sw: QNode<T> | null
    se: QNode<T> | null
}

function makeNode<T>(bounds: SpatialRect, depth: number): QNode<T> {
    return { bounds, entries: [], depth, nw: null, ne: null, sw: null, se: null }
}

class Quadtree<T> {

    private root: QNode<T>
    private cap: number
    private maxDepth: number
    private known: Set<T> = new Set()
    private _size = 0

    constructor(bounds: SpatialRect, capacity = 8, maxDepth = 8) {
        if (typeof bounds !== 'object' || bounds === null) {
            throw new Error('bounds is required')
        }
        if (typeof capacity !== 'number' || !isFinite(capacity) || capacity < 1) {
            throw new Error('capacity must be a positive integer')
        }
        if (typeof maxDepth !== 'number' || !isFinite(maxDepth) || maxDepth < 0) {
            throw new Error('maxDepth must be a non-negative integer')
        }
        this.root = makeNode(bounds, 0)
        this.cap = Math.floor(capacity)
        this.maxDepth = Math.floor(maxDepth)
    }

    get size(): number {
        return this._size
    }

    insert(item: T, bounds: SpatialRect): boolean {
        if (item === undefined) throw new Error('item can not be undefined')
        if (this.known.has(item)) return false
        if (!overlaps(bounds, this.root.bounds)) return false
        this.insertNode(this.root, item, bounds)
        this.known.add(item)
        this._size++
        return true
    }

    private insertNode(node: QNode<T>, item: T, bounds: SpatialRect): void {
        if (node.nw !== null) {
            if (this.tryChildren(node, item, bounds)) return
            node.entries.push({ item, bounds })
            return
        }
        if (node.entries.length >= this.cap && node.depth < this.maxDepth) {
            this.subdivide(node)
            if (this.tryChildren(node, item, bounds)) return
        }
        node.entries.push({ item, bounds })
    }

    private tryChildren(node: QNode<T>, item: T, bounds: SpatialRect): boolean {
        let matched: QNode<T> | null = null
        for (const child of [node.nw!, node.ne!, node.sw!, node.se!]) {
            if (overlaps(bounds, child.bounds)) {
                if (matched !== null) return false
                matched = child
            }
        }
        if (matched) { this.insertNode(matched, item, bounds); return true }
        return false
    }

    private subdivide(node: QNode<T>): void {
        const { x, y, width, height } = node.bounds
        const hw = width / 2
        const hh = height / 2
        const d = node.depth + 1
        node.nw = makeNode({ x, y, width: hw, height: hh }, d)
        node.ne = makeNode({ x: x + hw, y, width: hw, height: hh }, d)
        node.sw = makeNode({ x, y: y + hh, width: hw, height: hh }, d)
        node.se = makeNode({ x: x + hw, y: y + hh, width: hw, height: hh }, d)
        const keep: QEntry<T>[] = []
        for (const e of node.entries) {
            if (!this.tryChildren(node, e.item, e.bounds)) keep.push(e)
        }
        node.entries = keep
    }

    remove(item: T): boolean {
        if (!this.known.has(item)) return false
        const removed = this.removeNode(this.root, item)
        if (removed) { this.known.delete(item); this._size-- }
        return removed
    }

    private removeNode(node: QNode<T>, item: T): boolean {
        const idx = node.entries.findIndex(e => e.item === item)
        if (idx !== -1) { node.entries.splice(idx, 1); return true }
        if (node.nw) {
            return this.removeNode(node.nw, item) ||
                   this.removeNode(node.ne!, item) ||
                   this.removeNode(node.sw!, item) ||
                   this.removeNode(node.se!, item)
        }
        return false
    }

    update(item: T, bounds: SpatialRect): void {
        this.remove(item)
        this.insert(item, bounds)
    }

    query(bounds: SpatialRect): T[] {
        const result: T[] = []
        this.queryNode(this.root, bounds, result)
        return result
    }

    private queryNode(node: QNode<T>, bounds: SpatialRect, result: T[]): void {
        if (!overlaps(bounds, node.bounds)) return
        for (const e of node.entries) {
            if (overlaps(bounds, e.bounds)) result.push(e.item)
        }
        if (node.nw) {
            this.queryNode(node.nw, bounds, result)
            this.queryNode(node.ne!, bounds, result)
            this.queryNode(node.sw!, bounds, result)
            this.queryNode(node.se!, bounds, result)
        }
    }

    nearest(point: SpatialPoint, maxDist = Infinity): T | null {
        const state = { best: null as T | null, dist: maxDist }
        this.nearestNode(this.root, point, state)
        return state.best
    }

    private nearestNode(node: QNode<T>, p: SpatialPoint, state: { best: T | null; dist: number }): void {
        if (pointRectDist(p, node.bounds) >= state.dist) return
        for (const e of node.entries) {
            const d = pointRectDist(p, e.bounds)
            if (d < state.dist) { state.dist = d; state.best = e.item }
        }
        if (node.nw) {
            this.nearestNode(node.nw, p, state)
            this.nearestNode(node.ne!, p, state)
            this.nearestNode(node.sw!, p, state)
            this.nearestNode(node.se!, p, state)
        }
    }

    clear(): this {
        this.root = makeNode(this.root.bounds, 0)
        this.known.clear()
        this._size = 0
        return this
    }

}

export default Quadtree
