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
     * @param {T} data 
     */
    constructor(data = {}) {
        super()
        if (!this.isObject(data)) {
            throw new Error('state must be an object')
        }
        this.data = data
    }

    get() {
        return this.data
    }

    /**
     * 
     * @param {T} data 
     * @param {boolean} emit
     * @returns 
     */
    set(data, emit = true) {
        if (typeof data !== 'object') {
            throw new Error(`data=(${data}) must be an object`)
        }

        if (typeof emit !== 'boolean') {
            throw new Error(`data=(${data}) must be a boolean`)
        }

        this.setProperties(this.data, data, ['state'], emit)
        if (emit) {
            this.emit('change', data)
        }
        
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
            if (typeof target[key] === 'undefined') {
                throw new Error(`state does not have ${key} property`)
            }
            if (this.isObject(target[key]) && this.isObject(source[key])) {
                this.setProperties(target[key], source[key], propertyList, emit)
                this.emitChange(propertyList, source[key])
                continue
            }
            if (Array.isArray(target[key]) && Array.isArray(source[key])) {
                target[key] = source[key]
                continue
            }
            if (typeof target[key] === 'object' || typeof source[key] === 'object') {
                throw new Error(`invalid type [${propertyList.join('.')}], source=${source[key]}, target=${target[key]}`)
            }
            if (target[key] !== source[key]) {
                target[key] = source[key]
            }
            if (emit) {
                this.emitChange(propertyList, source[key])
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
    emitChange(properties, value) {
        let eventName = properties.join('.')
        this.emit(eventName, value)
    }
}

export default State