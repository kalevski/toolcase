import { Cameras, GameObjects, Math as M } from 'phaser'
import GameObject from '../base/GameObject'
import Matrix2 from '../structs/Matrix2'

class PerspectiveGrid extends GameObject {

    TEXTURE_KEY = '@toolcase/phaser+grid'

    /**
     * @private
     * @type {GameObjects.Graphics}
     */
    canvas = null

    /**
     * @private
     * @type {GameObjects.TileSprite}
     */
    gridTile = null

    /** @protected */
    onCreate() {
        this.canvas = this.scene.add.graphics({
            fillStyle: {
                color: 0x59758a,
                alpha: 1
            },
            lineStyle: {
                width: 1,
                color: 0xffffff,
                alpha: .3
            }
        })
        const { width, height } = this.game.config
        
        this.gridTile = this.scene.add.tileSprite(0, 0, width, height)
            .setVisible(false)
            .setOrigin(0)
        this.add(this.canvas).add(this.gridTile)
    }

    /** @protected */
    onDestroy() {

    }

    /**
     * 
     * @param {Matrix2} matrix 
     */
    setProjection(matrix) {
        let extremesRatio = 10

        this.gridTile.setVisible(false)
        if (this.scene.textures.exists(this.TEXTURE_KEY)) {
            this.scene.textures.remove(this.TEXTURE_KEY)
        }
        const { width, height } = this.game.config
        let extremes = new M.Vector2(extremesRatio, extremesRatio)
        
        let gridViewport = new M.Vector2()
        matrix.translate(extremes.x, extremes.y, gridViewport)

        this.canvas.fillRect(-width / 2, -height / 2, width, height)

        let pointA = new M.Vector2(0, 0)
        let pointB = new M.Vector2(0, 0)
        let pointC = new M.Vector2(0, 0)
        let pointD = new M.Vector2(0, 0)

        for (let x = -extremes.x; x < extremes.x; x++) {
            for (let y = -extremes.y; y < extremes.y; y++) {
                matrix.translate(x, y, pointA)
                matrix.translate(x, y + 1, pointB)
                matrix.translate(x + 1, y, pointC)
                matrix.translate(x + 1, y + 1, pointD)
                this.canvas.beginPath()
                this.canvas.moveTo(pointA.x, pointA.y)
                this.canvas.lineTo(pointB.x, pointB.y)
                this.canvas.lineTo(pointD.x, pointD.y)
                this.canvas.strokePath()
            }
        }

        let cutExtremes = new M.Vector2(0, 0)
        let cutPoints = [
            new M.Vector2(-extremesRatio / 2, -extremesRatio / 2),
            new M.Vector2(extremesRatio / 2, -extremesRatio / 2),
            new M.Vector2(-extremesRatio / 2, extremesRatio / 2),
            new M.Vector2(extremesRatio / 2, extremesRatio / 2)
        ]
        for (let cutPoint of cutPoints) {
            matrix.translate(cutPoint.x, cutPoint.y, cutPoint)
            if (Math.abs(cutPoint.x) > cutExtremes.x) {
                cutExtremes.x = Math.abs(cutPoint.x)
            }
            if (Math.abs(cutPoint.y) > cutExtremes.y) {
                cutExtremes.y = Math.abs(cutPoint.y)
            }
        }

        this.canvas.generateTexture(this.TEXTURE_KEY, cutExtremes.x, cutExtremes.y)
        this.canvas.clear()

        this.gridTile.setTexture(this.TEXTURE_KEY)
        this.gridTile.setVisible(true)
    }

    /**
     * 
     * @param {Cameras.Scene2D.Camera} camera 
     */
    move(camera) {
        this.setPosition(camera.scrollX, camera.scrollY)
        this.gridTile.setTilePosition(camera.scrollX, camera.scrollY)
    }

}

export default PerspectiveGrid