/**
 * @callback LogMessageFn
 * @param {import('./Level').LoggerLevel} level
 * @param {string} scope
 * @param {string} time
 * @param {Array<any>} messages
 */


class Logger {

    /**
     * @private
     * @type {string}
     */
    scope = null

    /**
     * @private
     * @type {LogMessageFn}
     */
    logMessageFn = null

    /**
     * 
     * @param {string} scope 
     * @param {LogMessageFn} logMessage 
     */
    constructor(scope, logMessage) {
        this.scope = scope
        this.logMessageFn = logMessage
    }

    error(...args) {
        this.log('error', ...args)
    }

    warning(...args) {
        this.log('warning', ...args)
    }

    info(...args) {
        this.log('info', ...args)
    }

    debug(...args) {
        this.log('debug', ...args)
    }

    verbose(...args) {
        this.log('verbose', ...args)
    }

    /**
     * 
     * @param {import('./Level').LoggerLevel} level 
     * @param  {...any} args 
     */
    log(level, ...args) {
        let time = new Date().toISOString()
        this.logMessageFn(level, this.scope, time, args)
    }

}

export default Logger