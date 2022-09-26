import logging from '@toolcase/logging'
import { GameObject } from '@toolcase/phaser-plus'

class TestObject extends GameObject {

    logger = logging.getLogger('test object')

    onCreate() {
        this.logger.info('created')

        let child = this.scene.pool.obtain('child_test')
        this.add(child)
    }

    /**
     * 
     * @param {GameObject} gameObject 
     */
    onAdd(gameObject) {
        this.logger.info('added')
    }

    /**
     * 
     * @param {GameObject} gameObject 
     */
    onRemove(gameObject) {
        this.logger.info('removed')
    }

    onDestroy() {
        this.logger.info('destroyed')
    }

}

export default TestObject