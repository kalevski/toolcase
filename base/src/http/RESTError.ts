import Status from './Status'

class RESTError extends Error {

    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }

    toJSON() {
        return {
            status: 'rejected',
            cause: this.message
        }
    }

    static notFound = (message: string = 'resource not found') => new RESTError(Status.NOT_FOUND, message)
    static notImplemented = (message: string = 'not implemented') => new RESTError(Status.NOT_IMPLEMENTED, message)
    static internalServerError = (message: string = 'internal server error') => new RESTError(Status.INTERNAL_SERVER_ERROR, message)
}

export default RESTError
