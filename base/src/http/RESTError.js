import Status from './Status'

class RESTError extends Error {

    /**
     * @readonly
     * @type {Status}
     */
    status = null

    /**
     * 
     * @param {string} message 
     * @param {Status} status 
     */
    constructor(status, message) {
        super(message)
        this.status = status
    }

    toJSON() {
        return {
            status: 'rejected',
            cause: this.message
        }
    }

}

RESTError.NOT_FOUND = new RESTError(Status.NOT_FOUND, 'resource not found')
RESTError.NOT_IMPLEMENTED = new RESTError(Status.NOT_IMPLEMENTED, 'not implemented')
RESTError.INTERNAL_SERVER_ERROR = new RESTError(Status.INTERNAL_SERVER_ERROR, 'internal server error')

export default RESTError