import Algorithm from './Algorithm'
import { AlgorithmOptions, PlacedRect, Rect, Size } from './types'

export type GuillotineSplit = 'shorter-axis' | 'longer-axis' | 'minimize-area'
export type GuillotineChoice = 'best-short-side-fit' | 'best-long-side-fit' | 'best-area-fit' | 'worst-area-fit'

class Guillotine extends Algorithm {

    private freeRects: Rect[] = []

    private splitStrategy: GuillotineSplit = 'minimize-area'

    private choice: GuillotineChoice = 'best-area-fit'

    private usedArea: number = 0

    private maxX: number = 0

    private maxY: number = 0

    constructor(options: AlgorithmOptions) {
        super(options)
        this.freeRects = [{ x: 0, y: 0, width: options.maxWidth, height: options.maxHeight }]
    }

    setSplit(strategy: GuillotineSplit): this {
        this.splitStrategy = strategy
        return this
    }

    setChoice(choice: GuillotineChoice): this {
        this.choice = choice
        return this
    }

    insert(size: Size): PlacedRect | null {
        const w = size.width
        const h = size.height
        if (w <= 0 || h <= 0) return null

        let bestIndex = -1
        let bestScore = Number.MAX_SAFE_INTEGER
        let bestRotated = false
        let bestW = 0
        let bestH = 0

        for (let i = 0; i < this.freeRects.length; i++) {
            const free = this.freeRects[i]!
            if (w <= free.width && h <= free.height) {
                const score = this.scoreFit(free, w, h)
                if (score < bestScore) {
                    bestScore = score
                    bestIndex = i
                    bestRotated = false
                    bestW = w
                    bestH = h
                }
            }
            if (this.allowRotation && w !== h && h <= free.width && w <= free.height) {
                const score = this.scoreFit(free, h, w)
                if (score < bestScore) {
                    bestScore = score
                    bestIndex = i
                    bestRotated = true
                    bestW = h
                    bestH = w
                }
            }
        }

        if (bestIndex === -1) return null

        const free = this.freeRects[bestIndex]!
        const placedRect: Rect = { x: free.x, y: free.y, width: bestW, height: bestH }
        const remainder = this.splitFreeRect(free, placedRect)
        this.freeRects.splice(bestIndex, 1)
        for (const r of remainder) {
            if (r.width > 0 && r.height > 0) this.freeRects.push(r)
        }

        this.usedArea += bestW * bestH
        if (placedRect.x + bestW > this.maxX) this.maxX = placedRect.x + bestW
        if (placedRect.y + bestH > this.maxY) this.maxY = placedRect.y + bestH

        return { ...placedRect, rotated: bestRotated }
    }

    merge(): void {
        let merged = true
        while (merged) {
            merged = false
            for (let i = 0; i < this.freeRects.length; i++) {
                for (let j = i + 1; j < this.freeRects.length; j++) {
                    const a = this.freeRects[i]!
                    const b = this.freeRects[j]!
                    if (a.width === b.width && a.x === b.x) {
                        if (a.y === b.y + b.height) {
                            this.freeRects[i] = { x: a.x, y: b.y, width: a.width, height: a.height + b.height }
                            this.freeRects.splice(j, 1)
                            merged = true
                            break
                        }
                        if (b.y === a.y + a.height) {
                            this.freeRects[i] = { x: a.x, y: a.y, width: a.width, height: a.height + b.height }
                            this.freeRects.splice(j, 1)
                            merged = true
                            break
                        }
                    }
                    if (a.height === b.height && a.y === b.y) {
                        if (a.x === b.x + b.width) {
                            this.freeRects[i] = { x: b.x, y: a.y, width: a.width + b.width, height: a.height }
                            this.freeRects.splice(j, 1)
                            merged = true
                            break
                        }
                        if (b.x === a.x + a.width) {
                            this.freeRects[i] = { x: a.x, y: a.y, width: a.width + b.width, height: a.height }
                            this.freeRects.splice(j, 1)
                            merged = true
                            break
                        }
                    }
                }
                if (merged) break
            }
        }
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

    private scoreFit(free: Rect, w: number, h: number): number {
        const leftoverHorizontal = free.width - w
        const leftoverVertical = free.height - h
        switch (this.choice) {
            case 'best-short-side-fit': return Math.min(leftoverHorizontal, leftoverVertical)
            case 'best-long-side-fit': return Math.max(leftoverHorizontal, leftoverVertical)
            case 'best-area-fit': return free.width * free.height - w * h
            case 'worst-area-fit': return -(free.width * free.height - w * h)
        }
    }

    private splitFreeRect(free: Rect, placed: Rect): Rect[] {
        const w = free.width - placed.width
        const h = free.height - placed.height
        let splitHorizontal: boolean
        switch (this.splitStrategy) {
            case 'shorter-axis': splitHorizontal = free.width <= free.height; break
            case 'longer-axis': splitHorizontal = free.width > free.height; break
            case 'minimize-area':
            default:
                splitHorizontal = placed.width * h > w * placed.height
                break
        }

        if (splitHorizontal) {
            return [
                { x: free.x + placed.width, y: free.y, width: w, height: placed.height },
                { x: free.x, y: free.y + placed.height, width: free.width, height: h }
            ]
        }
        return [
            { x: free.x + placed.width, y: free.y, width: w, height: free.height },
            { x: free.x, y: free.y + placed.height, width: placed.width, height: h }
        ]
    }

}

export default Guillotine
