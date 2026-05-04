import { LoggerLevel, getLevel, getLevelOrder } from './Level'
import Logger from './Logger'
import LogReporter from './LogReporter'

class LoggerFactory {

    private loggers: Map<string, Logger> = new Map()
    private reporters: LogReporter[]
    private levelOrder!: number

    constructor(reporters: LogReporter[] = []) {
        this.reporters = reporters
        this.level = 'info'
    }

    set level(level: LoggerLevel) {
        this.levelOrder = getLevelOrder(level)
    }

    get level(): LoggerLevel {
        return getLevel(this.levelOrder)
    }

    getLogger(scope: string = 'default'): Logger {
        if (!this.loggers.has(scope)) {
            const logger = new Logger(scope, this.onLog)
            this.loggers.set(scope, logger)
        }
        return this.loggers.get(scope)!
    }

    private onLog = (level: LoggerLevel, scope: string, time: string, messages: any[], overrideOrder?: number | null): void => {
        const order = getLevelOrder(level)
        const threshold = (overrideOrder === null || overrideOrder === undefined) ? this.levelOrder : overrideOrder
        if (threshold < order) {
            return
        }
        for (const reporter of this.reporters) {
            reporter.log(level, scope, time, messages)
        }
    }

}

export default LoggerFactory
