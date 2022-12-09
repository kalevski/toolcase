import { Feature } from '@toolcase/phaser-plus'

class FirstFeature extends Feature {

    onCreate() {
        this.logger.info('on create')
        this.emit('test', 1)

    }

    onUpdate() {
        // this.logger.info('on update')
    }

    onDestroy() {
        this.logger.info('on destroy')
    }

}

export default FirstFeature