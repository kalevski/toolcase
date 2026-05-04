import { LoggerLevel, getLevel, getLevelOrder } from './Level'

export type LogMessageFn = (level: LoggerLevel, scope: string, time: string, messages: any[], overrideOrder?: number | null) => void

class Logger {

    private scope: string
    private logMessageFn: LogMessageFn
    private levelOverride: number | null = null
    private context: Record<string, any> | null

    constructor(scope: string, logMessage: LogMessageFn, context: Record<string, any> | null = null) {
        this.scope = scope
        this.logMessageFn = logMessage
        this.context = context
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

    log(level: LoggerLevel, ...args: any[]): void {
        const time = new Date().toISOString()
        const messages = this.context === null ? args : [this.context, ...args]
        this.logMessageFn(level, this.scope, time, messages, this.levelOverride)
    }

    setLevel(level: LoggerLevel | null): void {
        this.levelOverride = level === null ? null : getLevelOrder(level)
    }

    getLevel(): LoggerLevel | null {
        return this.levelOverride === null ? null : getLevel(this.levelOverride)
    }

    withContext(context: Record<string, any>): Logger {
        const merged = { ...(this.context ?? {}), ...context }
        const child = new Logger(this.scope, this.logMessageFn, merged)
        child.levelOverride = this.levelOverride
        return child
    }

}

export default Logger
