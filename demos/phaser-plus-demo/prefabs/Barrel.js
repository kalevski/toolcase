import logging from '@toolcase/logging'
import { GameObject, Perspective2D } from '@toolcase/phaser-plus'
import { GameObjects } from 'phaser'

class Barrel extends Perspective2D.GameObject2D {

    /** @type {GameObjects.Image} */
    base = null

    logger = logging.getLogger('barrel')

    onCreate() {
        this.base = this.scene.add.image(0, -50, 'objects', 'barrel_vertical')
            // .setPipeline('Light2D')
        this.add(this.base)

        let shape = this.scene.cache.json.get('object_physics')

        this.scene.matter.add.gameObject(this, {
            shape: shape.barrel,
            frictionAir: 1.7
        }, true)
        this.setFixedRotation()
        this.scene.matter.world.remove(this.body)
        this.logger.info('created')
    }

    onAdd() {
        this.scene.matter.world.add(this.body)
        this.logger.info('added')
    }

    onRemove() {
        this.scene.matter.world.remove(this.body)
        this.logger.info('removed')
    }

    onDestroy() {
        this.logger.info('destroy')
    }

}

export default Barrel