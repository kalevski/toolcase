class ServiceRegistry {

    /**
     * @private
     * @type {Map<string,Object>}
     */
    services = null

    /**
     * @template T
     * @param {typeof Object} serviceClass 
     * @returns {T}
     */
    resolve(serviceClass) {
        let key = this.getServiceType(serviceClass)
        if (this.services.has(key)) {
            return this.services.get(key) || null
        }
        let service = new serviceClass()
        this.services.set(key, service)
        return service
    }

    /**
     * 
     * @param {typeof Object} serviceClass 
     */
    dispose(serviceClass) {
        let key = this.getServiceType(serviceClass)
        this.services.delete(key)
    }

    disposeAll() {
        this.services.clear()
    }

    /**
     * @private
     * @param {typeof Object} serviceClass 
     */
    getServiceType(serviceClass) {
        try {
            let key = serviceClass.prototype.constructor.name || null
            return key
        } catch (error) {
            throw new Error(`provided serviceClass is not a class`)
        }
    }

}

export default ServiceRegistry