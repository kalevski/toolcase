import { Perspective2D } from "@toolcase/phaser-plus";

class Barrel extends Perspective2D.GameObject2D {

    logger = null

    onCreate() {
        this.logger = this.scene.engine.getLogger('barrel')
        // this.logger.info('create')

        this.base = this.scene.add.sprite(0, 0, 'objects', 'barrel_vertical')
            .setOrigin(.5)
        this.add(this.base)
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