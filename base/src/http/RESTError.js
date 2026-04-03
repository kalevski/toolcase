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

RESTError.notFound = (message = 'resource not found') => new RESTError(Status.NOT_FOUND, message)
RESTError.notImplemented = (message = 'not implemented') => new RESTError(Status.NOT_IMPLEMENTED, message)
RESTError.internalServerError = (message = 'internal server error') => new RESTError(Status.INTERNAL_SERVER_ERROR, message)

export default RESTError