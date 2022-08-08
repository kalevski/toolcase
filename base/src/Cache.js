/**
 * @template T
 */
class Cache {

    /**
     * @typedef CachedEntry
     * @property {number} fetchedAt
     * @property {T} data
     */

    /**
     * @callback FetchFn
     * @returns {T|Promise<T>}
     */

    /**
     * @private
     * @type {Map<string,CachedEntry>}
     */
    entiries = new Map()

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

    async get(...args) {
        let currentTime = this.getTime()
        let hash = this.getHash(args)
        let entry = this.getEntry(hash)
        if (currentTime > entry.fetchedAt + this.ms) {
            entry.data = await this.fetchFn(...args)
            entry.fetchedAt = currentTime
        }
        return entry.data
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

    /**
     * @private
     * @param {any} filter 
     * @returns {string}
     */
    getHash(filter) {
        let hash = JSON.stringify(filter)
        return hash
    }

    /**
     * @private
     * @param {string} hash 
     */
    getEntry(hash) {
        let entry = this.entiries.get(hash) || null
        if (entry === null) {
            entry = { data: null, fetchedAt: 0 }
            this.entiries.set(hash, entry)
        }
        return entry
    }

}

export default Cache