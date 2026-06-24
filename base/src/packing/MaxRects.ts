import Algorithm from './Algorithm'
import { AlgorithmOptions, PlacedRect, Rect, Size } from './types'

export type MaxRectsHeuristic = 'best-short-side-fit' | 'best-long-side-fit' | 'best-area-fit' | 'bottom-left'

interface ScoreResult {
    score1: number
    score2: number
    rect: PlacedRect | null
}

class MaxRects extends Algorithm {

    private freeRects: Rect[] = []

    private heuristic: MaxRectsHeuristic = 'best-short-side-fit'

    private usedArea: number = 0

    private maxX: number = 0

    private maxY: number = 0

    constructor(options: AlgorithmOptions) {
        super(options)
        this.freeRects = [{ x: 0, y: 0, width: options.maxWidth, height: options.maxHeight }]
    }

    setHeuristic(heuristic: MaxRectsHeuristic): this {
        this.heuristic = heuristic
        return this
    }

    insert(size: Size): PlacedRect | null {
        const w = size.width
        const h = size.height
        if (w <= 0 || h <= 0) return null

        const result = this.findPlacement(w, h)
        if (result.rect === null) return null

        this.placeRect(result.rect)
        return result.rect
    }

    reset(): void {
        this.freeRects = [{ x: 0, y: 0, width: this.width, height: this.height }]
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

    private findPlacement(w: number, h: number): ScoreResult {
        let best: ScoreResult = { score1: Number.MAX_SAFE_INTEGER, score2: Number.MAX_SAFE_INTEGER, rect: null }

        for (const free of this.freeRects) {
            if (w <= free.width && h <= free.height) {
                const candidate = this.score(free, w, h, false)
                if (this.isBetter(candidate, best)) best = candidate
            }
            if (this.allowRotation && w !== h && h <= free.width && w <= free.height) {
                const candidate = this.score(free, h, w, true)
                if (this.isBetter(candidate, best)) best = candidate
            }
        }

        return best
    }

    private score(free: Rect, w: number, h: number, rotated: boolean): ScoreResult {
        const leftoverHorizontal = free.width - w
        const leftoverVertical = free.height - h
        const shortLeftover = Math.min(leftoverHorizontal, leftoverVertical)
        const longLeftover = Math.max(leftoverHorizontal, leftoverVertical)

        let score1: number
        let score2: number
        switch (this.heuristic) {
            case 'best-short-side-fit':
                score1 = shortLeftover
                score2 = longLeftover
                break
            case 'best-long-side-fit':
                score1 = longLeftover
                score2 = shortLeftover
                break
            case 'best-area-fit':
                score1 = free.width * free.height - w * h
                score2 = shortLeftover
                break
            case 'bottom-left':
                score1 = free.y + h
                score2 = free.x
                break
            default: throw new Error(`unknown heuristic: ${this.heuristic}`)
        }
        return {
            score1,
            score2,
            rect: { x: free.x, y: free.y, width: w, height: h, rotated }
        }
    }

    private isBetter(candidate: ScoreResult, best: ScoreResult): boolean {
        if (candidate.rect === null) return false
        if (best.rect === null) return true
        if (candidate.score1 < best.score1) return true
        if (candidate.score1 === best.score1 && candidate.score2 < best.score2) return true
        return false
    }

    private placeRect(used: PlacedRect): void {
        const newRects: Rect[] = []
        for (let i = 0; i < this.freeRects.length; i++) {
            const free = this.freeRects[i]!
            if (this.splitFreeNode(free, used, newRects)) {
                this.freeRects.splice(i, 1)
                i--
            }
        }
        for (const r of newRects) this.freeRects.push(r)
        this.pruneFreeList()

        this.usedArea += used.width * used.height
        if (used.x + used.width > this.maxX) this.maxX = used.x + used.width
        if (used.y + used.height > this.maxY) this.maxY = used.y + used.height
    }

    private splitFreeNode(free: Rect, used: Rect, out: Rect[]): boolean {
        if (used.x >= free.x + free.width || used.x + used.width <= free.x ||
            used.y >= free.y + free.height || used.y + used.height <= free.y) {
            return false
        }

        if (used.x < free.x + free.width && used.x + used.width > free.x) {
            if (used.y > free.y && used.y < free.y + free.height) {
                out.push({ x: free.x, y: free.y, width: free.width, height: used.y - free.y })
            }
            if (used.y + used.height < free.y + free.height) {
                out.push({
                    x: free.x,
                    y: used.y + used.height,
                    width: free.width,
                    height: free.y + free.height - (used.y + used.height)
                })
            }
        }

        if (used.y < free.y + free.height && used.y + used.height > free.y) {
            if (used.x > free.x && used.x < free.x + free.width) {
                out.push({ x: free.x, y: free.y, width: used.x - free.x, height: free.height })
            }
            if (used.x + used.width < free.x + free.width) {
                out.push({
                    x: used.x + used.width,
                    y: free.y,
                    width: free.x + free.width - (used.x + used.width),
                    height: free.height
                })
            }
        }
        return true
    }

    private pruneFreeList(): void {
        for (let i = 0; i < this.freeRects.length; i++) {
            for (let j = i + 1; j < this.freeRects.length; j++) {
                const a = this.freeRects[i]!
                const b = this.freeRects[j]!
                if (this.contains(b, a)) {
                    this.freeRects.splice(i, 1)
                    i--
                    break
                }
                if (this.contains(a, b)) {
                    this.freeRects.splice(j, 1)
                    j--
                }
            }
        }
    }

    private contains(outer: Rect, inner: Rect): boolean {
        return inner.x >= outer.x &&
            inner.y >= outer.y &&
            inner.x + inner.width <= outer.x + outer.width &&
            inner.y + inner.height <= outer.y + outer.height
    }

}

export default MaxRects
