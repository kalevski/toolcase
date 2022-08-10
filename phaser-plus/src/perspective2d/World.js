import logging from '@toolcase/logging'
import { GameObjects } from 'phaser'
import PathFinder from '../ai/PathFinder'
import Feature from '../Feature'
import WorldNavMesh from './WorldNavMesh'
import WorldObjects from './WorldObjects'
import Matrix2 from '../structs/Matrix2'
import PerspectiveGrid from './PerspectiveGrid'

class World extends Feature {

    /** @private */
    logger = logging.getLogger('world')

    /**
     * @readonly
     * @type {Matrix2}
     */
    projection = null

    /**
     * @type {PathFinder}
     */
    path = null

    /**
     * @type {WorldObjects}
     */
    objects = null

    /**
     * @type {GameObjects.Container} 
     */
    overlay = null

    /**
     * @type {PerspectiveGrid}
     */
    grid = null

    /** @protected */
    onCreate() {

        const {
            projection = null
        } = this.options
        
        if (projection === null) {
            this.projection = Matrix2.create()
        } else {
            this.projection = projection
        }

        this.objects = new WorldObjects(this.scene, this.projection, this.logger)
        this.overlay = this.scene.add.container()
        this.add(this.objects).add(this.overlay)

        this.path = new PathFinder(new WorldNavMesh(this.objects))

        this.grid = new PerspectiveGrid(this.scene, this.projection)
        this.add(this.grid)
    }

    add(child) {
        super.add(child)
        this.bringToTop(this.objects)
        this.bringToTop(this.overlay)
        return this
    }

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {
        this.objects.doUpdate(time, delta)
        this.path.onUpdate()
    }

    /**
     * @protected
     */
    onDestroy() {
        // TODO: need implementation
    }

}

export default World