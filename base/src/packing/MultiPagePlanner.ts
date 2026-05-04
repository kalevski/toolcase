import Algorithm from './Algorithm'
import { MemoryBudget, PackResult, PackedPage, PlacedSprite, PreparedSprite } from './types'

type AlgorithmFactory = () => Algorithm

interface PlanOptions {
    padding: number
    extrude: number
}

class MultiPagePlanner {

    private algorithmFactory: AlgorithmFactory

    private budget: MemoryBudget

    private padding: number

    private extrude: number

    private pageWidth: number

    private pageHeight: number

    constructor(algorithmFactory: AlgorithmFactory, options: PlanOptions, budget: MemoryBudget = {}) {
        this.algorithmFactory = algorithmFactory
        this.budget = budget
        this.padding = options.padding
        this.extrude = options.extrude

        const probe = algorithmFactory()
        this.pageWidth = (probe as any).width
        this.pageHeight = (probe as any).height
    }

    pack(sprites: PreparedSprite[]): PackResult {
        const pages: PackedPage[] = []
        let queue = sprites.slice()
        let totalPixels = 0
        const maxPages = this.budget.maxPages ?? Infinity
        const maxPagePixels = this.budget.maxPagePixels ?? Infinity
        const singlePixels = this.pageWidth * this.pageHeight

        if (this.budget.maxSinglePagePixels !== undefined && singlePixels > this.budget.maxSinglePagePixels) {
            return { pages, unpacked: queue }
        }

        const inflate = this.padding + 2 * this.extrude
        const offset = this.extrude

        while (queue.length > 0) {
            if (pages.length >= maxPages) break
            if (totalPixels + singlePixels > maxPagePixels) break

            const algorithm = this.algorithmFactory()
            algorithm.reset()

            const placed: PlacedSprite[] = []
            const carryOver: PreparedSprite[] = []

            for (const sprite of queue) {
                const w = sprite.width + inflate
                const h = sprite.height + inflate
                if (sprite.width <= 0 || sprite.height <= 0) {
                    placed.push({
                        ...sprite,
                        rotated: false,
                        rect: { x: 0, y: 0, width: 0, height: 0 },
                        page: pages.length
                    })
                    continue
                }
                const rect = algorithm.insert({ width: w, height: h })
                if (rect === null) {
                    carryOver.push(sprite)
                    continue
                }
                const finalW = rect.rotated ? sprite.height : sprite.width
                const finalH = rect.rotated ? sprite.width : sprite.height
                placed.push({
                    ...sprite,
                    rotated: rect.rotated,
                    rect: {
                        x: rect.x + offset,
                        y: rect.y + offset,
                        width: finalW,
                        height: finalH
                    },
                    page: pages.length
                })
            }

            if (placed.length === 0 && carryOver.length === queue.length) {
                return { pages, unpacked: queue }
            }

            const bounds = algorithm.usedBounds()
            let usedSum = 0
            for (const p of placed) usedSum += p.rect.width * p.rect.height

            pages.push({
                width: bounds.width,
                height: bounds.height,
                sprites: placed,
                occupancy: singlePixels === 0 ? 0 : usedSum / singlePixels
            })
            totalPixels += singlePixels
            queue = carryOver
        }

        return { pages, unpacked: queue }
    }

}

export default MultiPagePlanner
