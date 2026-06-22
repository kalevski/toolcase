import { LoggerLevel, getLevel, getLevelOrder, isKnownLevel } from './Level'

export type ClockFn = () => number
export type LogMessageFn = (level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[], overrideOrder?: number | null) => void
export type IsEnabledFn = (order: number, overrideOrder: number | null, scope: string) => boolean

class Logger {

    private scope: string
    private logMessageFn: LogMessageFn
    private levelOverride: number | null = null
    private context: Record<string, any> | null
    private isEnabledFn: IsEnabledFn | null
    private clock: ClockFn

    constructor(scope: string, logMessage: LogMessageFn, context: Record<string, any> | null = null, isEnabled: IsEnabledFn | null = null, clock: ClockFn = Date.now) {
        this.scope = scope
        this.logMessageFn = logMessage
        this.context = context
        this.isEnabledFn = isEnabled
        this.clock = clock
    }

    error(...args: any[]): void {
        this.log('error', ...args)
    }

    warning(...args: any[]): void {
        this.log('warning', ...args)
    }

    info(...args: any[]): void {
        this.log('info', ...args)
    }

    debug(...args: any[]): void {
        this.log('debug', ...args)
    }

    verbose(...args: any[]): void {
        this.log('verbose', ...args)
    }

    isEnabled(level: LoggerLevel): boolean {
        if (!this.isEnabledFn) {
            return true
        }
        return this.isEnabledFn(getLevelOrder(level), this.levelOverride, this.scope)
    }

    log(level: LoggerLevel, ...args: any[]): void {
        if (!isKnownLevel(level)) return
        const order = getLevelOrder(level)
        if (this.isEnabledFn && !this.isEnabledFn(order, this.levelOverride, this.scope)) {
            return
        }
        const time = this.clock()
        const evaluated = args.map(a => typeof a === 'function' ? a() : a)
        const fields = this.context ?? {}
        this.logMessageFn(level, this.scope, time, fields, evaluated, this.levelOverride)
    }

    setLevel(level: LoggerLevel | null): void {
        this.levelOverride = level === null ? null : getLevelOrder(level)
    }

    getLevel(): LoggerLevel | null {
        return this.levelOverride === null ? null : getLevel(this.levelOverride)
    }

    withContext(context: Record<string, any>): Logger {
        const merged = { ...(this.context ?? {}), ...context }
        const child = new Logger(this.scope, this.logMessageFn, merged, this.isEnabledFn, this.clock)
        child.levelOverride = this.levelOverride
        return child
    }

    child(childScope: string): Logger {
        const scope = `${this.scope}:${childScope}`
        const logger = new Logger(scope, this.logMessageFn, this.context, this.isEnabledFn, this.clock)
        logger.levelOverride = this.levelOverride
        return logger
    }

}

export default Logger
