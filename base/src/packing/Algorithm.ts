import { AlgorithmOptions, PlacedRect, Size } from './types'

abstract class Algorithm {

    protected width: number

    protected height: number

    protected allowRotation: boolean

    constructor(options: AlgorithmOptions) {
        this.width = options.maxWidth
        this.height = options.maxHeight
        this.allowRotation = options.allowRotation
    }

    abstract insert(size: Size): PlacedRect | null

    abstract reset(): void

    abstract occupancy(): number

    abstract usedBounds(): Size

}

export default Algorithm
