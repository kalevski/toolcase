import { LoggerLevel, getLevel, getLevelOrder, isKnownLevel } from './Level'

export type LogMessageFn = (level: LoggerLevel, scope: string, time: string, messages: any[], overrideOrder?: number | null) => void
export type IsEnabledFn = (order: number, overrideOrder: number | null) => boolean

class Logger {

    private scope: string
    private logMessageFn: LogMessageFn
    private levelOverride: number | null = null
    private context: Record<string, any> | null
    private isEnabledFn: IsEnabledFn | null

    constructor(scope: string, logMessage: LogMessageFn, context: Record<string, any> | null = null, isEnabled: IsEnabledFn | null = null) {
        this.scope = scope
        this.logMessageFn = logMessage
        this.context = context
        this.isEnabledFn = isEnabled
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
        return this.isEnabledFn(getLevelOrder(level), this.levelOverride)
    }

    log(level: LoggerLevel, ...args: any[]): void {
        if (!isKnownLevel(level)) return
        const order = getLevelOrder(level)
        if (this.isEnabledFn && !this.isEnabledFn(order, this.levelOverride)) {
            return
        }
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
        const child = new Logger(this.scope, this.logMessageFn, merged, this.isEnabledFn)
        child.levelOverride = this.levelOverride
        return child
    }

}

export default Logger
