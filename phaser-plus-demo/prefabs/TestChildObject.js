import logging from '@toolcase/logging'
import { GameObject } from '@toolcase/phaser-plus'

class TestChildObject extends GameObject {

    logger = logging.getLogger('test child object')

    onCreate() {
        this.logger.info('created')
    }

    /**
     * 
     * @param {GameObject} gameObject 
     */
    onAdd(gameObject) {
        this.logger.info('added to')
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

export default TestChildObject