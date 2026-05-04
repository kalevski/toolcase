import Algorithm from './Algorithm'
import { AlgorithmOptions, PlacedRect, Size } from './types'

export type SkylineHeuristic = 'bottom-left' | 'min-waste'

interface SkylineNode {
    x: number
    y: number
    width: number
}

class Skyline extends Algorithm {

    private skyline: SkylineNode[] = []

    private heuristic: SkylineHeuristic = 'bottom-left'

    private usedArea: number = 0

    private maxX: number = 0

    private maxY: number = 0

    constructor(options: AlgorithmOptions) {
        super(options)
        this.skyline = [{ x: 0, y: 0, width: options.maxWidth }]
    }

    setHeuristic(heuristic: SkylineHeuristic): this {
        this.heuristic = heuristic
        return this
    }

    insert(size: Size): PlacedRect | null {
        const w = size.width
        const h = size.height
        if (w <= 0 || h <= 0) return null

        let bestY = Number.MAX_SAFE_INTEGER
        let bestX = Number.MAX_SAFE_INTEGER
        let bestWaste = Number.MAX_SAFE_INTEGER
        let bestIndex = -1
        let bestRotated = false
        let bestW = 0
        let bestH = 0

        const tryFit = (tw: number, th: number, rotated: boolean): void => {
            for (let i = 0; i < this.skyline.length; i++) {
                const placement = this.fits(i, tw, th)
                if (placement === null) continue
                const score1 = this.heuristic === 'bottom-left'
                    ? placement.y + th
                    : placement.waste
                const score2 = this.heuristic === 'bottom-left'
                    ? placement.x
                    : placement.y + th

                const better = this.heuristic === 'bottom-left'
                    ? (score1 < bestY || (score1 === bestY && score2 < bestX))
                    : (score1 < bestWaste || (score1 === bestWaste && score2 < bestY))

                if (better) {
                    bestY = this.heuristic === 'bottom-left' ? score1 : placement.y + th
                    bestX = this.heuristic === 'bottom-left' ? score2 : placement.x
                    bestWaste = placement.waste
                    bestIndex = i
                    bestRotated = rotated
                    bestW = tw
                    bestH = th
                }
            }
        }

        tryFit(w, h, false)
        if (this.allowRotation && w !== h) tryFit(h, w, true)

        if (bestIndex === -1) return null

        const node = this.skyline[bestIndex]!
        const placedX = node.x
        const placedY = this.fits(bestIndex, bestW, bestH)!.y
        this.addLevel(bestIndex, { x: placedX, y: placedY, width: bestW, height: bestH })
        this.usedArea += bestW * bestH
        if (placedX + bestW > this.maxX) this.maxX = placedX + bestW
        if (placedY + bestH > this.maxY) this.maxY = placedY + bestH

        return { x: placedX, y: placedY, width: bestW, height: bestH, rotated: bestRotated }
    }

    reset(): void {
        this.skyline = [{ x: 0, y: 0, width: this.width }]
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

    private fits(index: number, w: number, h: number): { x: number, y: number, waste: number } | null {
        const node = this.skyline[index]!
        const x = node.x
        if (x + w > this.width) return null

        let widthLeft = w
        let i = index
        let y = node.y
        let waste = 0
        while (widthLeft > 0) {
            if (i >= this.skyline.length) return null
            const cur = this.skyline[i]!
            if (cur.y > y) {
                waste += (cur.y - y) * Math.min(widthLeft, cur.width)
                y = cur.y
            }
            if (y + h > this.height) return null
            widthLeft -= cur.width
            i++
        }
        return { x, y, waste }
    }

    private addLevel(index: number, used: { x: number, y: number, width: number, height: number }): void {
        const newNode: SkylineNode = { x: used.x, y: used.y + used.height, width: used.width }
        this.skyline.splice(index, 0, newNode)

        for (let i = index + 1; i < this.skyline.length; i++) {
            const cur = this.skyline[i]!
            const prev = this.skyline[i - 1]!
            if (cur.x < prev.x + prev.width) {
                const shrink = prev.x + prev.width - cur.x
                cur.x += shrink
                cur.width -= shrink
                if (cur.width <= 0) {
                    this.skyline.splice(i, 1)
                    i--
                    continue
                }
                break
            }
            break
        }

        for (let i = 0; i < this.skyline.length - 1; i++) {
            const a = this.skyline[i]!
            const b = this.skyline[i + 1]!
            if (a.y === b.y) {
                a.width += b.width
                this.skyline.splice(i + 1, 1)
                i--
            }
        }
    }

}

export default Skyline
