import { PlacedSprite } from './types'

class Rotator {

    apply(placed: PlacedSprite[]): PlacedSprite[] {
        for (const sprite of placed) {
            if (sprite.rotated) {
                const tmpW = sprite.sourceWidth
                sprite.sourceWidth = sprite.sourceHeight
                sprite.sourceHeight = tmpW
                const tmpOffX = sprite.sourceOffsetX
                sprite.sourceOffsetX = sprite.sourceOffsetY
                sprite.sourceOffsetY = tmpOffX
            }
        }
        return placed
    }

}

export default Rotator
