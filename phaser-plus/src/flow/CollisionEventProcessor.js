import { Physics } from 'phaser'
import CollisionEvent from './CollisionEvent'
import FlowProcessor from './FlowProcessor'

class CollisionEventProcessor extends FlowProcessor {

    /**
     * @private
     * @type {Map<string,CollisionEvent>}
     */
    eventMap = new Map()

    /** @protected */
    onCreate() {
        this.scene.matter.world.on(Physics.Matter.Events.COLLISION_START, this.onCollisionEnter, this)
        this.scene.matter.world.on(Physics.Matter.Events.COLLISION_END, this.onCollisionExit, this)
    }

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {}

    /** @protected */
    onDestroy() {
        for (let key of this.eventMap.keys()) {
            this.remove(key)
        }
    }

    /**
     * 
     * @param {string} label 
     * @param {new CollisionEvent} collisionEventClass 
     */
    add(label, collisionEventClass) {
        if (this.eventMap.has(label)) {
            throw new Error(`collision event for object ${label} is already registered`)
        }
        let event = new collisionEventClass(this.scene)
        if (event.type !== this.eventType) {
            throw new Error(`provided event with type ${event.type}, ${this.eventType} is acceptable`)
        }
        this.eventMap.set(label, event)
        event.onCreate()
        return this
    }

    /**
     * 
     * @param {string} label 
     */
    remove(label) {
        if (this.eventMap.has(label)) {
            this.eventMap.get(label).onDestroy()
            this.eventMap.delete(label)
        }
        return this
    }

    /**
     * @private
     * @param {Physics.Matter.Events.CollisionStartEvent} event 
     * @param {MatterJS.BodyType} bodyA 
     * @param {MatterJS.BodyType} bodyB 
     */
    onCollisionEnter(event, bodyA, bodyB) {
        if (this.eventMap.has(bodyA.label)) {
            this.eventMap.get(bodyA.label).onEnter(bodyA, bodyB, event)
        }
        if (this.eventMap.has(bodyB.label)) {
            this.eventMap.get(bodyB.label).onEnter(bodyB, bodyA, event)
        }
    }

    /**
     * @private
     * @param {Physics.Matter.Events.CollisionStartEvent} event 
     * @param {MatterJS.BodyType} bodyA 
     * @param {MatterJS.BodyType} bodyB 
     */
    onCollisionExit(event, bodyA, bodyB) {
        if (this.eventMap.has(bodyA.label)) {
            this.eventMap.get(bodyA.label).onExit(bodyA, bodyB, event)
        }
        if (this.eventMap.has(bodyB.label)) {
            this.eventMap.get(bodyB.label).onExit(bodyB, bodyA, event)
        }
    }

}

export default CollisionEventProcessor