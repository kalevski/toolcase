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

        /** @type {Barrel} */
        let barrel = null

        setTimeout(() => {
            barrel = this.scene.pool.obtain('barrel2')
            this.add(barrel)
            barrel.setPosition(30, 30)
        })

        setTimeout(() => {
            this.remove(barrel)
            this.scene.pool.release(barrel)
        }, 2000)

        setTimeout(() => {
            barrel = this.scene.pool.obtain('barrel2')
            this.add(barrel)
            barrel.setPosition(40, 40)
        }, 4000)

        this.logger.info('created')
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

export default Barrel