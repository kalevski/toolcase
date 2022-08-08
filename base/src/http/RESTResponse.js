import Status from './Status'

/**
 * @template T
 */
class RESTResponse {

    /**
     * @readonly
     * @type {Status}
     */
    status = null

    /**
     * @readonly
     * @type {T}
     */
    data = null

    /**
     * @readonly
     * @type {number|undefined}
     */
    count = null

    /**
     * 
     * @param {Status} status 
     * @param {T} data 
     * @param {number} count 
     */
    constructor(status, data, count = null) {
        this.status = status
        this.data = data
        if (typeof count === 'number') {
            this.count = count
        }
    }

    toJSON() {
        return {
            status: 'OK',
            count: this.count === null ? undefined : this.count,
            data: this.data,
        }
    }

}

export default RESTResponse