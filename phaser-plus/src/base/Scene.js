import { Logger } from '@toolcase/logging'
import { Scene as PhaserScene, Scenes } from 'phaser'
import GameObject from './GameObject'
import Engine from './Engine'
import FeatureRegistry from './FeatureRegistry'
import ServiceRegistry from './ServiceRegistry'
import GameObjectPool from './GameObjectPool'

class Scene extends PhaserScene {

    /**
     * @protected
     * @type {Engine}
     */
    engine = null

    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * @protected
     * @type {ServiceRegistry}
     */
    services = null

    /**
     * @protected
     * @type {FeatureRegistry}
     */
    features = null

    /**
     * @protected
     * @type {GameObjectPool<GameObject>}
     */
    pool = null

    /** @protected */
    onInit() {}

    /** @protected */
    onLoad() {}

    /** @protected */
    onCreate() {}

    /** @protected */
    onDestroy() {}

    /**
     * 
     * @param {string} key 
     * @param {Object<string,any>} payload 
     */
    goTo(key, payload) {
        if (typeof payload !== 'object') {
            payload = null
        }
        this.doDestroy()
        this.scene.stop()
        this.game.scene.start(key, payload)
    }

    /** @type {Object<string,any>} */
    get payload() {
        if (typeof this.scene.settings.data === 'object') {
            return this.scene.settings.data
        } else {
            return {}
        }
    }

    /** @private */
    init() {
        this.engine = this.initializeEngine()
        this.events.once(Scenes.Events.DESTROY, this.doDestroy, this)
        this.logger = this.engine.getLogger(`scene=${this.scene.key}`)
        this.services = this.engine.services
        this.features = new FeatureRegistry(this)
        this.pool = new GameObjectPool(this)
        this.logger.info('initialized')
        this.onInit()
    }

    /** @private */
    preload() {
        this.onLoad()
    }

    /** @private */
    create() {
        this.onCreate()
    }

    /**
     * @private
     * @param {number} time 
     * @param {number} delta 
     */
    update(time, delta) {
        this.features.doUpdate(time, delta)
        for (let children of this.children.list) {
            if (children instanceof GameObject) {
                children.doUpdate(time, delta)
            }
        }
    }

    /** @private */
    doDestroy() {
        this.onDestroy()
    }

    /**
     * @private
     * @returns {Engine}
     */
    initializeEngine() {
        if (this.game.engine instanceof Engine) {
            return this.game.engine
        }
        this.game.engine = new Engine()
        return this.game.engine
    }

}

export default Scene