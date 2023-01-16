import EventEmitter from './EventEmitter'
/**
 * @template {EventEmitter.ValidEventTypes} EventTypes
 * @template T
 * @template Context
 */
class Broadcast {

    /**
     * @private
     * @type {EventEmitter<EventTypes,T,Context>}
     */
    events = new EventEmitter()

    /**
     * 
     * @param {EventTypes} event 
     * @param {T} eventListener 
     * @param {Context} [context] 
     * @returns {this}
     */
    on(event, eventListener, context) {
        this.events.on(event, eventListener, context)
        return this
    }

    /**
     * 
     * @param {EventTypes} event 
     * @param {T} eventListener 
     * @param {Context} [context] 
     * @returns {this}
     */
    off(event, eventListener, context) {
        this.events.off(event, eventListener, context)
        return this
    }

    /**
     * 
     * @param {EventTypes} event 
     * @param {T} eventListener 
     * @param {Context} [context] 
     * @returns {this}
     */
    once(event, eventListener, context) {
        this.events.once(event, eventListener, context)
        return this
    }

    /**
     * @protected
     * @param {EventTypes} event 
     * @param  {...T} messages 
     * @returns {boolean}
     */
    emit(event, ...messages) {
        return this.events.emit(event, ...messages)
    }

    /**
     * @param {EventTypes} [event] 
     */
    removeAllListeners(event) {
        this.events.removeAllListeners(event)
        return this
    }

    /**
     * @param {EventTypes} [event] 
     */
    listenerCount(event) {
        return this.events.listenerCount(event)
    }

    eventNames() {
        return this.events.eventNames()
    }

}

export default Broadcast