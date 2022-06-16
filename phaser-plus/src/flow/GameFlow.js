import { Time } from 'phaser'
import { EventEmitter, generateId } from '@toolcase/base'
import logging from '@toolcase/logging'
import GameEvent from './GameEvent'
import SensorEvent from './SensorEvent'
import SensorProcessor from './SensorProcessor'
import TimeEvent from './TimeEvent'
import Scene from '../Scene'

/**
 * @typedef Timer
 * @property {string} eventId
 * @property {number} tick
 * @property {number} interval
 * @property {number} fired
 */

class GameFlow {

    /** @private */
    logger = logging.getLogger('flow')

    /**
     * @private
     */
    emitter = new EventEmitter()

    /**
     * @private
     * @type {Scene}
     */
    scene = null

    /**
     * @private
     * @type {Map<string,SensorEvent>}
     */
    sensorEvents = new Map()

    /**
     * @private
     * @type {Map<string,TimeEvent>}
     */
    timeEvents = new Map()

    /**
     * @private
     * @type {SensorProcessor}
     */
    processor = null

    /**
     * @private
     * @type {Time.TimerEvent}
     */
    timeLoop = null

    /**
     * @private
     * @type {Array<Timer>}
     */
    timers = []

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        this.scene = scene
        this.timeLoop = this.scene.time.addEvent({
            delay: 1000,
            callback: this.doTick,
            callbackScope: this,
            loop: true
        })
    }

    setSensorProcessor(processor) {
        if (this.processor !== null) {
            this.processor.onDestroy()
        }
        this.processor = processor
        this.processor.onCreate(this.sensorEvents)
    }

    /**
     * 
     * @param {string} eventName 
     * @param {typeof SensorEvent} sensorEventClass 
     */
    addSensorEvent(eventName, sensorEventClass) {
        if (this.sensorEvents.has(eventName)) {
            this.logger.warning(`sensor event=(${eventName}) is already registered`)
            return this
        }
        let sensorEvent = new sensorEventClass(this.scene, this, this.logger, this.processor.getLabel(eventName))
        this.sensorEvents.set(eventName, sensorEvent)
        sensorEvent.onCreate()
        return this
    }

    /**
     * 
     * @param {typeof TimeEvent} timeEventClass 
     * @param {number} interval
     * @param {number} delay
     */
    addTimeEvent(timeEventClass, interval = 1, delay = 0) {
        if (typeof interval !== 'number') {
            interval = 1
        }
        if (typeof delay !== 'number') {
            delay = 0
        }

        let uniqueId = generateId(12)
        let timeEvent = new timeEventClass(this.scene, this, this.logger)
        this.timeEvents.set(uniqueId, timeEvent)
        this.timers.push({
            eventId: uniqueId,
            tick: delay % interval,
            interval: interval,
            fired: 0
        })
        timeEvent.onCreate()
        return this
    }

    /**
     * 
     * @param {string} eventName 
     * @param {typeof GameEvent} eventClass 
     * @returns 
     */
    addEvent(eventName, eventClass) {
        if (this.emitter.listenerCount(eventName) > 0) {
            this.logger.warning(`event=(${eventName}) is already registered`)
            return this
        }
        let event = new eventClass(this.scene, this, this.logger)
        this.emitter.addListener(eventName, event.onFire, event)
        event.onCreate()
        return this
    }

    pause() {
        this.timeLoop.paused = true
        return this
    }

    resume() {
        this.timeLoop.paused = false
        return this
    }

    dispatch(eventName, ...messages) {
        if (this.emitter.listenerCount(eventName) === 0) {
            this.logger.warning(`event=(${eventName}) is not registered`)
            return this
        }
        this.emitter.emit(eventName, ...messages)
        return this
    }

    /** @private */
    doTick() {
        for (let timer of this.timers) {
            ++timer.tick

            if (timer.tick >= timer.interval) {
                let event = this.timeEvents.get(timer.eventId)
                timer.tick = 0
                ++timer.fired
                event.onFire(timer.fired)
            }
        }
    }

    
    destroy() {
        this.emitter.removeAllListeners()
        this.sensorEvents.clear()
        this.timeEvents.clear()
        this.processor = null
        this.timeLoop.destroy()
        this.timers = []
    }

}

export default GameFlow