import logging from '@toolcase/logging'
import { GameObject, Perspective2D } from '@toolcase/phaser-plus'
import { GameObjects } from 'phaser'

class Barrel2 extends Perspective2D.GameObject2D {

    /** @type {GameObjects.Image} */
    base = null

    logger = logging.getLogger('child barrel')

    onCreate() {
        this.base = this.scene.add.image(0, -50, 'objects', 'barrel_vertical')
            // .setPipeline('Light2D')
        this.add(this.base)
        this.logger.info('create')
    }

    onAdd() {
        this.logger.info('added')
    }

    onRemove() {
        this.logger.info('removed')
    }

    onDestroy() {
        this.logger.info('destroy')
    }

}

export default Barrel2