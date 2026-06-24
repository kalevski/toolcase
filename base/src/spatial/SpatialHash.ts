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

type CellEntry = { keys: Set<string>; bounds: SpatialRect }

class SpatialHash<T> {

    private cs: number
    private cells: Map<string, Set<T>> = new Map()
    private entries: Map<T, CellEntry> = new Map()
    private _size = 0

    constructor(cellSize: number) {
        if (typeof cellSize !== 'number' || !isFinite(cellSize) || cellSize <= 0) {
            throw new Error('cellSize must be a positive finite number')
        }
        this.cs = cellSize
    }

    get size(): number {
        return this._size
    }

    private key(cx: number, cy: number): string {
        return `${cx},${cy}`
    }

    private coordsForRect(rect: SpatialRect): Array<[number, number]> {
        const minCX = Math.floor(rect.x / this.cs)
        const minCY = Math.floor(rect.y / this.cs)
        const maxCX = Math.floor((rect.x + rect.width) / this.cs)
        const maxCY = Math.floor((rect.y + rect.height) / this.cs)
        const out: Array<[number, number]> = []
        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                out.push([cx, cy])
            }
        }
        return out
    }

    insert(item: T, bounds: SpatialRect): void {
        if (item === undefined) throw new Error('item can not be undefined')
        if (this.entries.has(item)) return
        const keys = new Set<string>()
        for (const [cx, cy] of this.coordsForRect(bounds)) {
            const k = this.key(cx, cy)
            keys.add(k)
            let cell = this.cells.get(k)
            if (!cell) { cell = new Set(); this.cells.set(k, cell) }
            cell.add(item)
        }
        this.entries.set(item, { keys, bounds })
        this._size++
    }

    remove(item: T): boolean {
        const entry = this.entries.get(item)
        if (!entry) return false
        for (const k of entry.keys) {
            const cell = this.cells.get(k)
            if (cell) { cell.delete(item); if (cell.size === 0) this.cells.delete(k) }
        }
        this.entries.delete(item)
        this._size--
        return true
    }

    update(item: T, bounds: SpatialRect): void {
        this.remove(item)
        this.insert(item, bounds)
    }

    query(bounds: SpatialRect): T[] {
        const seen = new Set<T>()
        const result: T[] = []
        for (const [cx, cy] of this.coordsForRect(bounds)) {
            const cell = this.cells.get(this.key(cx, cy))
            if (!cell) continue
            for (const item of cell) {
                if (seen.has(item)) continue
                seen.add(item)
                const entry = this.entries.get(item)
                if (entry && overlaps(bounds, entry.bounds)) result.push(item)
            }
        }
        return result
    }

    nearest(point: SpatialPoint, maxDist = Infinity): T | null {
        const { cs } = this
        const cx0 = Math.floor(point.x / cs)
        const cy0 = Math.floor(point.y / cs)
        let best: T | null = null
        let bestDist = maxDist
        const seen = new Set<T>()
        for (let r = 0; r <= 1e4; r++) {
            if (best !== null && (r - 1) * cs >= bestDist) break
            if (r === 0) {
                this.scanCell(cx0, cy0, point, seen, (item, d) => {
                    if (d < bestDist) { bestDist = d; best = item }
                })
            } else {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) < r && Math.abs(dy) < r) continue
                        this.scanCell(cx0 + dx, cy0 + dy, point, seen, (item, d) => {
                            if (d < bestDist) { bestDist = d; best = item }
                        })
                    }
                }
            }
        }
        return best
    }

    private scanCell(
        cx: number,
        cy: number,
        point: SpatialPoint,
        seen: Set<T>,
        cb: (item: T, dist: number) => void
    ): void {
        const cell = this.cells.get(this.key(cx, cy))
        if (!cell) return
        for (const item of cell) {
            if (seen.has(item)) continue
            seen.add(item)
            const entry = this.entries.get(item)
            if (entry) cb(item, pointRectDist(point, entry.bounds))
        }
    }

    clear(): this {
        this.cells.clear()
        this.entries.clear()
        this._size = 0
        return this
    }

}

export default SpatialHash
