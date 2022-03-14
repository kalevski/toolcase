import { getLevel, getLevelOrder } from './Level'
import Logger from './Logger'
import LogReporter from './LogReporter'

class LoggerFactory {

    /**
     * @private
     * @type {Map<string,Logger>}
     */
    loggers = new Map()

    /**
     * @private
     * @type {Array<LogReporter>}
     */
    reporters = []

    /**
     * @private
     * @type {number}
     */
    levelOrder = null

    /**
     * 
     * @param {Array<LogReporter>} reporters 
     */
    constructor(reporters = []) {
        this.reporters = reporters
        this.level = 'info'
    }

    set level(level) {
        this.levelOrder = getLevelOrder(level)
    }

    get level() {
        return getLevel(this.levelOrder)
    }

    getLogger(scope = 'default') {
        if (!this.loggers.has(scope)) {
            let logger = new Logger(scope, this.onLog)
            this.loggers.set(scope, logger)
        }
        return this.loggers.get(scope)
    }

    /**
     * @private
     * @param {import('./Level').LoggerLevel} level 
     * @param {string} scope 
     * @param {string} time
     * @param {Array<any>} messages
     */
    onLog = (level, scope, time, messages) => {
        let order = getLevelOrder(level)
        if (this.levelOrder < order) {
            return
        }
        for (let reporter of this.reporters) {
            reporter.log(level, scope, time, messages)
        }
    }

}

export default LoggerFactory