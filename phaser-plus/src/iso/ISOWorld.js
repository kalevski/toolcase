import logging from '@toolcase/logging'
import { GameObjects } from 'phaser'
import PathFinder from '../ai/PathFinder'
import Feature from '../Feature'
import ISONavMesh from './ISONavMesh'
import ISOWorldObjects from './ISOWorldObjects'
import Matrix2 from '../structs/Matrix2'

class ISOWorld extends Feature {

    /** @private */
    logger = logging.getLogger('ISO World')

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
     * @type {ISOWorldObjects}
     */
    objects = null

    /**
     * @type {GameObjects.Container} 
     */
    overlay = null
    
    /**
     * @readonly
     */
    size = 64

    /** @protected */
    onCreate() {

        const {
            size = 64
        } = this.options
        this.size = size
        
       this.projection = Matrix2.getISO(size, size)

        this.objects = new ISOWorldObjects(this.scene, this.projection, this.logger)
        this.overlay = this.scene.add.container()
        this.add(this.objects).add(this.overlay)

        this.path = new PathFinder(new ISONavMesh(this.objects))
    }

    add(child) {
        super.add(child)
        this.bringToTop(this.objects)
        this.bringToTop(this.overlay)
        return this
    }

    /**
     * @private
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {
        this.objects.doUpdate(time, delta)
    }

    /** @private */
    onDestroy() {
        // TODO: need implementation
    }

}

export default ISOWorld