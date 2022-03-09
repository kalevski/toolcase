import EventEmitter from './EventEmitter'
/**
 * @template EventTypes
 * @template T
 * @template Context
 */
class Broadcast {

    /**
     * @callback EventListener
     * @param {T} message
     */

    /**
     * @private
     * @type {EventEmitter.<EventTypes,Context>}
     */
    events = new EventEmitter()

    /**
     * 
     * @param {EventTypes} event 
     * @param {EventListener} eventListener 
     * @param {Context} context 
     * @returns {this}
     */
    on(event, eventListener, context) {
        this.events.on(event, eventListener, context)
        return this
    }

    /**
     * 
     * @param {EventTypes} event 
     * @param {EventListener} eventListener 
     * @param {Context} context 
     * @returns {this}
     */
    off(event, eventListener, context) {
        this.events.off(event, eventListener, context)
        return this
    }

    /**
     * 
     * @param {EventTypes} event 
     * @param {EventListener} eventListener 
     * @param {Context} context 
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
     * @private
     */
    clearListeners() {
        this.events.removeAllListeners()
    }

}

export default Broadcast