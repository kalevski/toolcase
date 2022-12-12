/**
 * @template T
 */
 class ObjectPool {

    /**
     * @callback ResetFn
     * @param {T} object
     * @return {void}
     */

    /**
     * @callback InstanceFn
     * @param {new T} objectClass
     * @return {T}
     */

    /**
     * @private
     * @type {Array<T>}
     */
    pool = []

    /**
     * @private
     * @type {new T}
     */
    objectClass = null

    /**
     * @readonly
     * @type {number}
     */
    instances = 0

    /**
     * @private
     * @type {ResetFn}
     */
    resetFn = () => {}

    /**
     * @private
     * @type {InstanceFn}
     */
    instanceFn = () => new this.objectClass() 

    /**
     * 
     * @param {new T} objectClass 
     * @param {ResetFn} resetFn 
     * @param {InstanceFn} instanceFn
     */
    constructor(objectClass, resetFn = null, instanceFn = null) {
        this.objectClass = objectClass

        if (typeof resetFn === 'function') {
            this.resetFn = resetFn
        }

        if (typeof instanceFn === 'function') {
            this.instanceFn = instanceFn
        }
    }

    /**
     * 
     * @returns {T}
     */
    obtain() {
        if (this.pool.length === 0) {
            this.createInstance()
        }
        let object = this.pool.pop()
        return object
    }

    release = (object) => {
        this.resetFn(object)
        this.pool.push(object)
        return this
    }

    dispose() {
        this.pool = []
    }

    /**
     * @private
     */
    createInstance() {
        let object = this.instanceFn(this.objectClass)
        this.instances++
        if (typeof object.release === 'undefined') {
            object.release = () => this.release(object)
        } else {
            throw new Error(`object ${JSON.stringify(object)} already has release function`)
        }
        this.pool.push(object)
    }



}

export default ObjectPool