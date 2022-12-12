import { Perspective2D } from "@toolcase/phaser-plus";

class Barrel extends Perspective2D.GameObject2D {

    logger = null

    onCreate() {
        this.logger = this.scene.engine.getLogger('barrel')
        // this.logger.info('create')

        this.base = this.scene.add.sprite(0, -50, 'objects', 'barrel_vertical')
            .setOrigin(.5)
        this.add(this.base)

        this.scene.matter.add.gameObject(this)

        this.setBody({
            type: 'rectangle',
            width: 100,
            height: 100
        }, {
            isStatic: true
        })
    }

    onUpdate(time, delta) {
        // this.setTransformY(this.transform.y + 0.005 * delta)
    }

    onAdd() {
        // this.logger.info('add')
    }

    onRemove() {
        // this.logger.info('remove')
    }

    onDestroy() {
        this.logger.info('destroy')
    }

}

export default Barrel