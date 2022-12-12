import Event from './Event'
import FlowProcessor from './FlowProcessor'

/**
 * @typedef TimerDef
 * @property {Event} event
 * @property {string} name
 * @property {number} time
 * @property {any} payload
 */

class EventProcessor extends FlowProcessor {
    
    /**
     * @private
     * @type {Array<TimerDef>}
     */
    queue = []

    /**
     * @private
     * @type {Map<string,Event>}
     */
    eventMap = new Map()

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {
        let indices = []
        for (let index = 0; index < this.queue.length; index++) {
            let def = this.queue[index]
            def.time += delta / 1000
            if (def.time > 0) {
                def.event.onFire(def.payload)
                indices.unshift(index)
            }
        }
        for (let index of indices){
            this.queue.splice(index, 1)
        }
    }

    /** @protected */
    onDestroy() {
        this.queue = []
        for (let key of this.eventMap.keys()) {
            this.remove(key)
        }
    }

    /**
     * 
     * @param {string} eventName 
     * @param {new Event} eventClass 
     */
    add(eventName, eventClass) {
        if (this.eventMap.has(eventName)) {
            throw new Error(`event with name=${eventName} is already registered`)
        }
        let event = new eventClass(this.scene)
        if (event.type !== this.eventType) {
            throw new Error(`provided event with type ${event.type}, ${this.eventType} is acceptable`)
        }
        this.eventMap.set(eventName, event)
        event.onCreate()
        return this
    }

    /**
     * 
     * @param {string} eventName 
     */
    remove(eventName) {
        if (this.eventMap.has(eventName)) {
            this.eventMap.get(eventName).onDestroy()
            this.eventMap.delete(eventName)
        }
        return this
    }

    /**
     * 
     * @param {string} eventName 
     * @param {any} payload 
     * @param {number} delay
     */
    trigger(eventName, payload, delay = 0) {
        if (!this.eventMap.has(eventName)) {
            throw new Error(`event name=${eventName} is not registered`)
        }

        if (typeof delay !== 'number' || delay < 0) {
            throw new Error(`delay must be a positive number`)
        }

        if (delay === 0) {
            this.eventMap.get(eventName).onFire(payload)
            return this
        }

        this.queue.push({
            name: eventName,
            time: -delay,
            event: this.eventMap.get(eventName),
            payload: payload
        })
        return this
    }

}

export default EventProcessor