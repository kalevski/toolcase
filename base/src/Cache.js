/**
 * @template T
 */
class Cache {

    /**
     * @callback FetchFn
     * @returns {T|Promise<T>}
     */

    /**
     * @private
     * @type {T}
     */
    data = null

    /**
     * @readonly
     * @type {number}
     */
    fetchedAt = 0

    /**
     * @private
     * @type {number}
     */
    ms = 0

    /**
     * @private
     * @type {FetchFn}
     */
    fetchFn = null

    /**
     * 
     * @param {FetchFn} fetchFn 
     * @param {number} ms 
     */
    constructor(fetchFn, ms = 0) {
        if (typeof fetchFn !== 'function') {
            throw new Error(`fetchFn must be a function, ${fetchFn} provided`)
        }
        
        this.fetchFn = fetchFn
        this.setMS(ms)
    }

    async get() {
        let currentTime = this.getTime()
        if (currentTime > this.fetchedAt + this.ms) {
            this.data = await this.fetchFn()
            this.fetchedAt = currentTime
        }
        return this.data
    }

    setMS(ms = 0) {
        if (typeof ms !== 'number') {
            throw new Error(`ms must be a number, ${ms} provided`)
        }
        this.ms = ms
    }

    /**
     * @private
     * @returns {number}
     */
    getTime() {
        return new Date().getTime()
    }

}

export default Cache