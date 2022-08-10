import { GameObjects, Math as M } from 'phaser'
import Scene from '../Scene'
import Matrix2 from '../structs/Matrix2'
import logging from '@toolcase/logging'

class PerspectiveGrid extends GameObjects.Graphics {

    /**
     * @private
     * @type {Matrix2}
     */
    projection = null

    /** @private */
    logger = logging.getLogger('perspective grid')

    /**
     * 
     * @param {Scene} scene 
     * @param {Matrix2} projection
     */
    constructor(scene, projection) {
        super(scene)
        this.projection = projection
        
    }

    draw() {
        const { width, height } = this.scene.game.config
        let bounds = this.getPerspectiveBounds()

        this.fillStyle(0x1565c0, 1)
        this.lineStyle(1, 0xffffff, 1)

        this.fillRect(-width / 2, -height / 2, width, height)

        let pointA = new M.Vector2(0, 0)
        let pointB = new M.Vector2(0, 0)
        let pointC = new M.Vector2(0, 0)
        let pointD = new M.Vector2(0, 0)
        for(let x = -bounds; x < bounds; x++) {
            for(let y = -bounds; y < bounds; y++) {
                this.projection.translate(x, y, pointA)
                this.projection.translate(x, y + 1, pointB)
                this.projection.translate(x + 1, y, pointC)
                this.projection.translate(x + 1, y + 1, pointD)
                this.beginPath()
                this.moveTo(pointA.x, pointA.y)
                this.lineTo(pointB.x, pointB.y)
                this.lineTo(pointD.x, pointD.y)
                this.strokePath()
            }
        }
    }

    /** @private */
    getPerspectiveBounds() {
        const { width, height } = this.scene.game.config
        let minValue = Number.MAX_SAFE_INTEGER
        this.projection.forEach(value => {
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

export default PerspectiveGrid