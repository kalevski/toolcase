import logging from '@toolcase/logging'
import { GameObjects, Math as M } from 'phaser'
import Matrix2 from '../structs/Matrix2'
import Feature from '../Feature'

class DebugGrid extends Feature {

    /** @private */
    logger = logging.getLogger('perspective grid')

    /**
     * @private
     * @type {GameObjects.Graphics}
     */
    graphics = null

    /** @private */
    onCreate() {
        this.graphics = this.scene.add.graphics()
        this.add(this.graphics)
    }

    /** @private */
    onDestroy() {

    }

    /**
     * 
     * @param {Matrix2} projection 
     */
    draw(projection) {
        this.graphics.clear()

        const { width, height } = this.game.config
        let bounds = this.getPerspectiveBounds(projection)
        
        this.graphics.fillStyle(0x59758a, 1)
        this.graphics.lineStyle(1, 0xffffff, .3)
        
        this.graphics.fillRect(-width / 2, -height / 2, width, height)
        
        let pointA = new M.Vector2(0, 0)
        let pointB = new M.Vector2(0, 0)
        let pointC = new M.Vector2(0, 0)
        let pointD = new M.Vector2(0, 0)
        for(let x = -bounds; x < bounds; x++) {
            for(let y = -bounds; y < bounds; y++) {
                projection.translate(x, y, pointA)
                projection.translate(x, y + 1, pointB)
                projection.translate(x + 1, y, pointC)
                projection.translate(x + 1, y + 1, pointD)
                this.graphics.beginPath()
                this.graphics.moveTo(pointA.x, pointA.y)
                this.graphics.lineTo(pointB.x, pointB.y)
                this.graphics.lineTo(pointD.x, pointD.y)
                this.graphics.strokePath()
            }
        }
    }

    /**
     * 
     * @param {Matrix2} projection 
     */
    getPerspectiveBounds(projection) {
        const { width, height } = this.game.config
        let minValue = Number.MAX_SAFE_INTEGER
        projection.forEach(value => {
            if (value === 0) {
                return
            }
            if (Math.abs(value) < minValue) {
                minValue = Math.abs(value)
            }
        })
        return Math.ceil(Math.max(width, height) / minValue) / 2
    }

}

export default DebugGrid