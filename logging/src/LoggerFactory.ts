import { LoggerLevel, getLevel, getLevelOrder, isKnownLevel, KNOWN_LEVELS } from './Level'
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
        if (!isKnownLevel(level)) {
            throw new RangeError(`Unknown log level: "${level}". Valid levels: ${KNOWN_LEVELS.join(', ')}`)
        }
        this.levelOrder = getLevelOrder(level)
    }

    get level(): LoggerLevel {
        return getLevel(this.levelOrder)
    }

    getLogger(scope: string = 'default'): Logger {
        if (!this.loggers.has(scope)) {
            const logger = new Logger(scope, this.onLog, null, this.isEnabled)
            this.loggers.set(scope, logger)
        }
        return this.loggers.get(scope)!
    }

    addReporter(reporter: LogReporter): void {
        this.reporters.push(reporter)
    }

    removeReporter(reporter: LogReporter): void {
        const i = this.reporters.indexOf(reporter)
        if (i !== -1) this.reporters.splice(i, 1)
    }

    private isEnabled = (order: number, overrideOrder: number | null): boolean => {
        const threshold = overrideOrder ?? this.levelOrder
        return threshold >= order
    }

    private onLog = (level: LoggerLevel, scope: string, time: string, messages: any[], overrideOrder?: number | null): void => {
        const order = getLevelOrder(level)
        const threshold = (overrideOrder === null || overrideOrder === undefined) ? this.levelOrder : overrideOrder
        if (threshold < order) {
            return
        }
        for (const reporter of this.reporters) {
            try {
                reporter.log(level, scope, time, messages)
            } catch {
                // a reporter must never break logging or sibling reporters
            }
        }
    }

}

export default LoggerFactory
