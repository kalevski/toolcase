import Algorithm from './Algorithm'
import { AlgorithmOptions, PlacedRect, Size } from './types'

export type ShelfFit = 'next-fit' | 'first-fit' | 'best-fit'

interface ShelfRow {
    y: number
    height: number
    cursor: number
}

class Shelf extends Algorithm {

    private shelves: ShelfRow[] = []

    private fit: ShelfFit = 'best-fit'

    private nextY: number = 0

    private usedArea: number = 0

    private maxX: number = 0

    private maxY: number = 0

    constructor(options: AlgorithmOptions) {
        super(options)
    }

    setFit(fit: ShelfFit): this {
        this.fit = fit
        return this
    }

    insert(size: Size): PlacedRect | null {
        const w = size.width
        const h = size.height
        if (w <= 0 || h <= 0) return null
        if (w > this.width && (!this.allowRotation || h > this.width)) return null
        if (h > this.height && (!this.allowRotation || w > this.height)) return null

        const placement = this.findShelf(w, h)
        if (placement === null) return null

        const row = placement.row
        const placedW = placement.rotated ? h : w
        const placedH = placement.rotated ? w : h

        const rect: PlacedRect = {
            x: row.cursor,
            y: row.y,
            width: placedW,
            height: placedH,
            rotated: placement.rotated
        }
        row.cursor += placedW
        if (placedH > row.height) row.height = placedH
        this.usedArea += placedW * placedH
        if (rect.x + placedW > this.maxX) this.maxX = rect.x + placedW
        if (rect.y + placedH > this.maxY) this.maxY = rect.y + placedH
        return rect
    }

    reset(): void {
        this.shelves = []
        this.nextY = 0
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

    private findShelf(w: number, h: number): { row: ShelfRow, rotated: boolean } | null {
        const candidates: { row: ShelfRow, rotated: boolean, score: number }[] = []
        for (const row of this.shelves) {
            const fitsNormal = row.cursor + w <= this.width && h <= row.height
            if (fitsNormal) {
                candidates.push({ row, rotated: false, score: row.height - h })
            }
            if (this.allowRotation) {
                const fitsRotated = row.cursor + h <= this.width && w <= row.height
                if (fitsRotated) candidates.push({ row, rotated: true, score: row.height - w })
            }
        }

        if (this.fit === 'next-fit') {
            const last = this.shelves[this.shelves.length - 1]
            if (last) {
                const onLast = candidates.find(c => c.row === last)
                if (onLast) return { row: onLast.row, rotated: onLast.rotated }
            }
        } else if (this.fit === 'first-fit') {
            if (candidates.length > 0) return { row: candidates[0]!.row, rotated: candidates[0]!.rotated }
        } else if (this.fit === 'best-fit') {
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.score - b.score)
                return { row: candidates[0]!.row, rotated: candidates[0]!.rotated }
            }
        }

        return this.openShelf(w, h)
    }

    private openShelf(w: number, h: number): { row: ShelfRow, rotated: boolean } | null {
        const useRotated = this.allowRotation && (w > this.width || (h <= this.width && w > h))
        const placedW = useRotated ? h : w
        const placedH = useRotated ? w : h
        if (placedW > this.width) return null
        if (this.nextY + placedH > this.height) return null
        const row: ShelfRow = { y: this.nextY, height: placedH, cursor: 0 }
        this.shelves.push(row)
        this.nextY += placedH
        return { row, rotated: useRotated }
    }

}

export default Shelf
