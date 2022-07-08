import { GameObjects } from 'phaser'
import { Logger } from '@toolcase/logging'
import GameFlow from './GameFlow'
import Scene from '../Scene'

class SensorEvent {

    /**
     * @protected
     * @type {Scene}
     */
    scene = null

    /**
     * @protected
     * @type {GameFlow}
     */
    flow = null

    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * @private
     * @readonly
     * @type {string}
     */
    label = null

    /**
     * 
     * @param {Scene} scene
     * @param {GameFlow} flow 
     * @param {Logger} logger
     * @param {string} label
     */
    constructor(scene, flow, logger, label) {
        this.scene = scene
        this.flow = flow
        this.logger = logger
        this.label = label
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {GameObjects.GameObject} gameObject 
     * @param {GameObjects.GameObject} sensorObject 
     */
    onEnter(gameObject, sensorObject) {}

    /**
     * @protected
     * @param {GameObjects.GameObject} gameObject 
     * @param {GameObjects.GameObject} sensorObject 
     * @param {string} actionName
     */
    onFire(gameObject, sensorObject, actionName) {}

    /**
     * @protected
     * @param {GameObjects.GameObject} gameObject 
     * @param {GameObjects.GameObject} sensorObject 
     */
    onExit(gameObject, sensorObject) {}

}

export default SensorEvent