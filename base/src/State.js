import Broadcast from './Broadcast'

/**
 * @template T
 * @augments Broadcast<string,object,any>
 */
class State extends Broadcast {

    /**
     * @private
     * @type {T} 
     */
    data = null

    /**
     * 
     * @param {Partial<T>} data 
     */
    constructor(data = {}) {
        super()
        if (!this.isObject(data)) {
            throw new Error('state must be an object')
        }
        this.data = data
    }

    /**
     * @returns {Partial<T>}
     */
    get() {
        return this.data
    }

    /**
     * 
     * @param {Partial<T>} data 
     */
    set(data, emit = true) {
        if (typeof data !== 'object') {
            throw new Error(`data=(${data}) must be an object`)
        }

        if (typeof emit !== 'boolean') {
            throw new Error(`data=(${data}) must be a boolean`)
        }

        const props = ['state']
        this.emitEvent(props, this.data, emit)
        this.setProperties(this.data, data, props, emit)
        
        return this
    }

    empty(emit = true) {
        this.data = {}
        this.emitEvent(['state'], undefined, emit)
        return this
    }

    /**
     * @private
     * @param {object} target
     * @param {object} source
     * @param {Array<string>} properties
     * @param {boolean} emit
     */
    setProperties(target, source, properties = ['state'], emit = true) {
        for (let key of Object.keys(source)) {
            let propertyList = [...properties, key]
            this.emitEvent(propertyList, source[key], emit)
            if (typeof target[key] === 'undefined') {
                target[key] = source[key]
                continue
            }
            
            if (this.isObject(target[key]) && this.isObject(source[key])) {
                this.setProperties(target[key], source[key], propertyList, emit)
                continue
            }
            
            if (Array.isArray(target[key]) && Array.isArray(source[key])) {
                target[key] = source[key]
                continue
            }
            
            if(typeof source[key] === 'undefined') {
                delete target[key]
            }
            
            if (typeof target[key] === 'object' || typeof source[key] === 'object') {
                throw new Error(`invalid type [${propertyList.join('.')}], source=${source[key]}, target=${target[key]}`)
            }
            
            if (target[key] !== source[key]) {
                target[key] = source[key]
            }
        }
    }

    /**
     * @private
     * @param {any} value 
     */
    isObject(value) {
        return (value && typeof value === 'object' && !Array.isArray(value))
    }


    /**
     * @private
     * @param {Array<string>} properties 
     * @param {any} value 
     */
    emitEvent(properties, value, canEmit = true) {
        if (!canEmit) {
            return
        }
        let eventName = properties.join('.')
        this.emit(eventName, value)
    }
}

export default State