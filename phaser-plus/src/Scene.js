import { Scene as PhaserScene } from 'phaser'
import logging, { Logger } from '@toolcase/logging'
import FeatureRegistry from './registry/FeatureRegistry'
import ServiceRegistry from './registry/ServiceRegistry'
import GameFlow from './flow/GameFlow'
import Feature from './Feature'
import DOMFeature from './DOMFeature'

class Scene extends PhaserScene {

    /** @type {Object<string,any>} */
    payload = null

    /** 
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * @type {FeatureRegistry}
     */
    features = null

    /**
     * @type {GameFlow}
     */
    flow = null

    /**
     * @type {ServiceRegistry}
     */
    services = null

    /** @protected */
    onInit() {}

    /** @protected */
    onLoad() {}

    /** @protected */
    onCreate() {}

    /** @protected */
    onDestroy() {}

    /**
     * @param {Object<string,any>} payload 
     */
    init(payload = {}) {
        this.payload = payload
        if (this.features !== null) {
            return this.onInit()
        }
        if (typeof this.game.services === 'undefined') {
            this.game.services = new ServiceRegistry()   
        }

        this.logger = logging.getLogger(`scene=${this.scene.key}`)
        this.services = this.game.services
        this.features = new FeatureRegistry(this)
        this.flow = new GameFlow(this)

        this.features.on('register', this.onFeatureRegister, this)

        this.logger.verbose('initialized')
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
        this.features.forEach((_, feature) => feature.onUpdate(time, delta))
    }

    /** @private */
    destroy() {
        this.features.off('register', this.onFeatureRegister, this)
        this.onDestroy()
        this.features.destroyAll()
        this.flow.destroy()
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
     * @param {Feature} feature 
     */
    onFeatureRegister(feature) {
        this.add.existing(feature)
        feature.onCreate()
    }
}

export default Scene