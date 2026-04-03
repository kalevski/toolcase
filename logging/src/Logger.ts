import { LoggerLevel } from './Level'

export type LogMessageFn = (level: LoggerLevel, scope: string, time: string, messages: any[]) => void

class Logger {

    private scope: string
    private logMessageFn: LogMessageFn

    constructor(scope: string, logMessage: LogMessageFn) {
        this.scope = scope
        this.logMessageFn = logMessage
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
        this.logMessageFn(level, this.scope, time, args)
    }

}

export default Logger
