import { PreparedSprite, Sprite } from './types'

class Trimmer {

    private alphaThreshold: number

    constructor(alphaThreshold: number = 0) {
        this.alphaThreshold = alphaThreshold
    }

    trim(input: Sprite): PreparedSprite {
        if (this.alphaThreshold < 0 || !input.pixels) {
            return this.passthrough(input)
        }

        const grid = input.pixels
        const w = grid.width
        const h = grid.height
        const threshold = this.alphaThreshold

        let top = 0
        outerTop: for (; top < h; top++) {
            for (let x = 0; x < w; x++) {
                if (grid.alphaAt(x, top) > threshold) break outerTop
            }
        }
        if (top === h) {
            return {
                id: input.id,
                width: 0,
                height: 0,
                sourceWidth: w,
                sourceHeight: h,
                sourceOffsetX: 0,
                sourceOffsetY: 0,
                rotated: false,
                pixels: grid
            }
        }

        let bottom = h - 1
        outerBottom: for (; bottom >= top; bottom--) {
            for (let x = 0; x < w; x++) {
                if (grid.alphaAt(x, bottom) > threshold) break outerBottom
            }
        }

        let left = 0
        outerLeft: for (; left < w; left++) {
            for (let y = top; y <= bottom; y++) {
                if (grid.alphaAt(left, y) > threshold) break outerLeft
            }
        }

        let right = w - 1
        outerRight: for (; right >= left; right--) {
            for (let y = top; y <= bottom; y++) {
                if (grid.alphaAt(right, y) > threshold) break outerRight
            }
        }

        return {
            id: input.id,
            width: right - left + 1,
            height: bottom - top + 1,
            sourceWidth: w,
            sourceHeight: h,
            sourceOffsetX: left,
            sourceOffsetY: top,
            rotated: false,
            pixels: grid
        }
    }

    private passthrough(input: Sprite): PreparedSprite {
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

export default Trimmer
