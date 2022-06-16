import { GameObjects, Physics } from 'phaser'
import SensorEvent from './SensorEvent'
import CollisionProcessor from './SensorProcessor'

class MatterJSProcessor extends CollisionProcessor {

    /**
     * @private
     * @readonly
     */
    PREFIX = 'action'

    /**
     * @private
     * @type {Map<string,SensorEvent>}
     */
    events = null

    /**
     * @private
     * @type {Map<string,GameObjects.GameObject>}
     */
    sensorByObject = new Map()

    /**
     * @private
     * @type {Map<string,string>}
     */
    eventNameByObject = new Map()

    /**
     * @private
     * @type {Physics.Matter.World}
     */
    world = null

    /**
     * 
     * @param {Physics.Matter.World} world 
     */
    constructor(world, sensorPrefix = 'action') {
        super()
        this.world = world
        this.PREFIX = sensorPrefix
    }

    /**
     * @private
     * @param {Map<string,SensorEvent>} events 
     */
    onCreate(events) {
        this.events = events
        this.world.on('collisionstart', this.onCollision, this)
        this.world.on('collisionend', this.onCollision, this)
    }

    /**
     * @private
     */
    onDestroy() {
        this.world.off('collisionstart', this.onCollision, this)
        this.world.off('collisionend', this.onCollision, this)
    }

    /**
     * @private
     * @param {string} eventName 
     */
    getLabel(eventName) {
        return `${this.PREFIX}:${eventName}`
    }

    /**
     * @param {GameObjects.GameObject} gameObject 
     * @param {string} actionName 
     */
    doAction(gameObject, actionName) {
        if (gameObject.name === '') {
            return
        }

        let sensorObject = this.sensorByObject.get(gameObject.name) || null
        let eventName = this.eventNameByObject.get(gameObject.name) || null
        if (sensorObject === null || eventName === null) {
            return
        }
        let event = this.events.get(eventName) || null
        event.onFire(gameObject, sensorObject, actionName)
    }

    
    /**
     * @private
     * @param {MatterJS.IEventCollision} event 
     */
    onCollision(event) {
        const { bodyA, bodyB } = event.pairs[0]
        if (!bodyA.isSensor && !bodyB.isSensor) {
            return
        }
        if (bodyA.gameObject === null || bodyB.gameObject === null) {
            return
        }
        let sensor = bodyA.isSensor ? bodyA : bodyB
        let object = !bodyA.isSensor ? bodyA : bodyB
        if (typeof sensor.active === 'undefined') {
            sensor.active = false
        }
        const [ prefix = null, sensorName = null ] = (sensor.label || '').split(':')
        if (!(prefix === this.PREFIX && sensorName !== null)) {
            return
        }

        let sensorEvent = this.events.get(sensorName) || null
        if (sensorEvent === null) {
            return
        }

        if (object.gameObject.name === '' || sensor.gameObject.name === '') {
            return
        }

        if (event.name === 'collisionStart') {
            this.onSensorEnter(object.gameObject, sensor.gameObject, sensorEvent, sensorName)
        } else if (event.name === 'collisionEnd') {
            this.onSensorExit(object.gameObject, sensor.gameObject, sensorEvent)
        }
    }

    /**
     * @private
     * @param {GameObjects.GameObject} gameObject 
     * @param {GameObjects.GameObject} sensorObject 
     * @param {SensorEvent} event 
     * @param {string} name 
     */
    onSensorEnter(gameObject, sensorObject, event, name) {
        let currentSensor = this.sensorByObject.get(gameObject.name) || null
        if (currentSensor !== null) {
            let sensorEventName = this.eventNameByObject.get(gameObject.name)
            let sensorEvent = this.events.get(sensorEventName)
            sensorEvent.onExit(gameObject, currentSensor)
        }

        this.sensorByObject.set(gameObject.name, sensorObject)
        this.eventNameByObject.set(gameObject.name, name)

        event.onEnter(gameObject, sensorObject)
    }

    /**
     * @private
     * @param {GameObjects.GameObject} gameObject 
     * @param {GameObjects.GameObject} sensorObject 
     * @param {SensorEvent} event 
     */
    onSensorExit(gameObject, sensorObject, event) {
        let currentSensor = this.sensorByObject.get(gameObject.name) || null
        if (currentSensor === null) {
            return
        }

        if (currentSensor.body.id === sensorObject.body.id) {
            event.onExit(gameObject, sensorObject)
            this.sensorByObject.delete(gameObject.name)
            this.eventNameByObject.delete(gameObject.name)
        }
    }

}

export default MatterJSProcessor