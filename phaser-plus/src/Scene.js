import { Scene as PScene } from 'phaser'
import logging, { Logger } from '@toolcase/logging'
import ModuleRegistry from './ModuleRegistry'
import ServiceRegistry from './ServiceRegistry'
import GameStateRegistry from './GameStateRegistry'

class Scene extends PScene {

    /** @type {Object<string,any>} */
    payload = null

    /** @type {ModuleRegistry} */
    modules = null

    /** @type {ServiceRegistry} */
    services = null

    /**
     * @type {GameStateRegistry}
     */
    state = null

    /** 
     * @protected
     * @type {Logger}
     */
    logger = null

    /** @protected */
    onInit() {}

    /** @protected */
    onLoad() {}

    /** @protected */
    onCreate() {}

    /** @protected */
    onDestroy() {}

    //onUpdate (time, delta)

    /**
     * 
     * @param {Object<string,any>} payload 
     */
    init(payload = {}) {
        this.payload = payload
        if (this.modules !== null) {
            return this.onInit()
        }
        this.logger = logging.getLogger(`scene=${this.scene.key}`)
        this.modules = new ModuleRegistry(this)
        if (typeof this.game.services === 'undefined') {
            this.game.services = new ServiceRegistry(this.game)
        }
        this.services = this.game.services
        this.state = new GameStateRegistry(this.modules, this.services)
        this.logger.verbose('initialized')
        this.modules.on('register', this.onModuleRegister, this)
        this.onInit()
    }

    preload() {
        this.onLoad()
    }

    create() {
        this.onCreate()
    }

    update(time, delta) {
        this.modules.forEach((key, module) => {
            module.onUpdate(time, delta)
        })
    }

    destroy() {
        this.modules.off('register', this.onModuleRegister, this)
        this.modules.destroyAll()
    }

    /**
     * 
     * @param {string} key 
     * @param {Object<string,any>} payload
     */
    goTo(key, payload = {}) {
        this.destroy()
        this.scene.stop()
        this.game.scene.start(key, payload)
    }

    /**
     * @private
     * @param {Module} module 
     */
    onModuleRegister(module) {
        this.add.existing(module)
        module.onCreate()
    }
}

export default Scene