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
     * @param {typeof Object} object
     * @return {T}
     */

    /**
     * @private
     * @type {Array<T>}
     */
    pool = []

    /**
     * @private
     * @type {typeof Object}
     */
    objectClass = null

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
     * @param {typeof Object} objectClass 
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

    /**
     * @private
     */
    createInstance() {
        let object = this.instanceFn(this.objectClass)
        if (typeof object.release === 'undefined') {
            object.release = () => this.releaseObject(object)
        } else {
            // TODO: throw error
        }
        this.pool.push(object)
    }

    releaseObject = (object) => {
        this.resetFn(object)
        this.pool.push(object)
        return this
    }

}

export default ObjectPool