import logging from '@toolcase/logging'
import { Scene, Module, GameState } from '@toolcase/phaser-plus'

class Gamepad extends GameState {

    state = {

    }

    onCreate() {
        logging.level = 'verbose'
        this.register('start', this.start)
    }

    start() {
        this.logger.info('test')
        return 'hehe'
    }

    stop() {

    }

}

class ModuleB extends Module {
    
    onCreate() {
        this.logger.info('create!')
        let element = document.createElement('div')
        element.innerHTML = 'test'
        this.setHTML(element)
    }
}

class ModuleA extends Module {

    onCreate() {
        this.logger.info('create!')

        setInterval(() => {
            this.dispatch('test', { hehe: 1 })
        }, 2000)
    }

}

class BasicFeatures extends Scene {

    onInit() {
        this.logger.info('init')
    }

    onLoad() {
        this.logger.info('load')
    }

    onCreate() {
        this.add.text(200, 200, 'test')
        this.logger.info('create')
        this.modules.register('A', ModuleA)
            .bind('test', (payload) => this.state.invoke('gamepad.start', payload))
        this.modules.register('B', ModuleB)
        

        this.state.use('gamepad', Gamepad)
    }

    onDestroy() {
        this.logger.info('destroy')
    }

}

export default BasicFeatures