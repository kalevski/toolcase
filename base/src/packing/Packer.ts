import Algorithm from './Algorithm'
import BinaryTree from './BinaryTree'
import Guillotine from './Guillotine'
import MaxRects from './MaxRects'
import MultiPagePlanner from './MultiPagePlanner'
import potCeil from './potCeil'
import Rotator from './Rotator'
import Shelf from './Shelf'
import Skyline from './Skyline'
import Sorter from './Sorter'
import Trimmer from './Trimmer'
import { AlgorithmKind, AlgorithmOptions, PackResult, PackedPage, PackerOptions, PreparedSprite, Sprite } from './types'

class Packer {

    private options: PackerOptions

    constructor(options: PackerOptions) {
        this.options = options
    }

    pack(inputs: Sprite[]): PackResult {
        const trimmer = new Trimmer(this.options.alphaThreshold)
        const rotator = new Rotator()

        let prepared: PreparedSprite[] = inputs.map(sprite => {
            return this.options.trim ? trimmer.trim(sprite) : Packer.passthrough(sprite)
        })

        if (this.options.sort !== 'none') {
            const sorter = new Sorter(this.options.sort)
            prepared = sorter.sort(prepared)
        }

        const planner = new MultiPagePlanner(
            () => this.createAlgorithm(),
            { padding: this.options.padding, extrude: this.options.extrude },
            this.options.budget
        )

        const result = planner.pack(prepared)
        for (const page of result.pages) {
            page.sprites = rotator.apply(page.sprites)
            this.finalizePage(page)
        }
        return result
    }

    private createAlgorithm(): Algorithm {
        const algoOptions: AlgorithmOptions = {
            maxWidth: this.options.maxWidth,
            maxHeight: this.options.maxHeight,
            allowRotation: this.options.allowRotation,
            padding: this.options.padding,
            extrude: this.options.extrude,
            pot: this.options.pot
        }
        const kind: AlgorithmKind = this.options.algorithm
        switch (kind) {
            case 'max-rects': return new MaxRects(algoOptions)
            case 'guillotine': return new Guillotine(algoOptions)
            case 'shelf': return new Shelf(algoOptions)
            case 'skyline': return new Skyline(algoOptions)
            case 'binary-tree': return new BinaryTree(algoOptions)
        }
    }

    private finalizePage(page: PackedPage): void {
        let width = page.width
        let height = page.height
        if (this.options.pot === 'page') {
            width = potCeil(width)
            height = potCeil(height)
        } else if (this.options.pot === 'square') {
            const side = potCeil(Math.max(width, height))
            width = side
            height = side
        }
        page.width = width
        page.height = height
        const total = width * height
        if (total === 0) {
            page.occupancy = 0
            return
        }
        let usedSum = 0
        for (const sprite of page.sprites) usedSum += sprite.rect.width * sprite.rect.height
        page.occupancy = usedSum / total
    }

    private static passthrough(input: Sprite): PreparedSprite {
        return {
            id: input.id,
            width: input.width,
            height: input.height,
            sourceWidth: input.width,
            sourceHeight: input.height,
            sourceOffsetX: 0,
            sourceOffsetY: 0,
            rotated: false,
            pixels: input.pixels
        }
    }

}

export default Packer
