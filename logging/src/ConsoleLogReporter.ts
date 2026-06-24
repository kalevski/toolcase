import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import { type LogFormatter } from './Formatter'

export interface ConsoleLogReporterOptions {
    color?: boolean
    timestamp?: boolean
    prefix?: string | ((level: LoggerLevel, scope: string, time: number) => string)
    objects?: 'compact' | 'pretty'
    formatter?: LogFormatter
}

const ANSI_RESET = '\x1b[0m'

const ANSI_COLORS: Record<string, string> = {
    error:   '\x1b[31m',
    warning: '\x1b[33m',
    info:    '\x1b[36m',
    debug:   '\x1b[90m',
    verbose: '\x1b[90m',
}

const BROWSER_STYLES: Record<string, string> = {
    error:   'color:#e74c3c;font-weight:bold',
    warning: 'color:#e67e22;font-weight:bold',
    info:    'color:#2980b9',
    debug:   'color:#7f8c8d',
    verbose: 'color:#95a5a6',
}

function isNode(): boolean {
    return typeof process !== 'undefined'
        && typeof process.versions !== 'undefined'
        && typeof process.versions.node !== 'undefined'
}

function resolveColor(requested: boolean | undefined, node: boolean): boolean {
    if (requested === false) return false
    if (requested === true) return true
    if (node) {
        if (typeof process !== 'undefined' && process.env != null && 'NO_COLOR' in process.env) return false
        return typeof process !== 'undefined' && process.stdout?.isTTY === true
    }
    return true
}

function serializeMessage(x: any): any {
    if (x === null || typeof x !== 'object') return x
    if (x instanceof Error) {
        return x.stack ?? `${x.name}: ${x.message}`
    }
    try {
        return JSON.stringify(x, null, 2)
    } catch {
        return String(x)
    }
}

class ConsoleLogReporter extends LogReporter {

    private readonly useColor: boolean
    private readonly node: boolean
    private readonly showTimestamp: boolean
    private readonly prefixOption: ConsoleLogReporterOptions['prefix']
    private readonly objectMode: 'compact' | 'pretty'
    private readonly formatterOption?: LogFormatter

    constructor(options: ConsoleLogReporterOptions = {}) {
        super()
        this.node = isNode()
        this.useColor = resolveColor(options.color, this.node)
        this.showTimestamp = options.timestamp !== false
        this.prefixOption = options.prefix
        this.objectMode = options.objects ?? 'compact'
        this.formatterOption = options.formatter
    }

    private buildPrefix(level: LoggerLevel, scope: string, time: number): string {
        if (typeof this.prefixOption === 'function') {
            return this.prefixOption(level, scope, time)
        }
        if (typeof this.prefixOption === 'string') {
            return this.prefixOption
        }
        return this.showTimestamp
            ? `${level.toUpperCase()} [${new Date(time).toISOString()}] | ${scope}:`
            : `${level.toUpperCase()} | ${scope}:`
    }

    private prepareMessages(messages: any[]): any[] {
        if (this.objectMode === 'compact') return messages
        return messages.map(serializeMessage)
    }

    private writeLine(level: LoggerLevel, line: string): void {
        if (this.useColor && this.node) {
            const ansi = ANSI_COLORS[level] ?? ''
            const colored = `${ansi}${line}${ANSI_RESET}`
            if (level === 'error') console.error(colored)
            else if (level === 'warning') console.warn(colored)
            else console.log(colored)
        } else if (this.useColor) {
            const style = BROWSER_STYLES[level] ?? ''
            if (level === 'error') console.error(`%c${line}`, style)
            else if (level === 'warning') console.warn(`%c${line}`, style)
            else console.log(`%c${line}`, style)
        } else {
            if (level === 'error') console.error(line)
            else if (level === 'warning') console.warn(line)
            else console.log(line)
        }
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        if (this.formatterOption) {
            const line = this.formatterOption(level, scope, time, fields, messages)
            this.writeLine(level, line)
            return
        }

        const prefix = this.buildPrefix(level, scope, time)
        const msgs = this.prepareMessages(messages)

        if (this.useColor && this.node) {
            const ansi = ANSI_COLORS[level] ?? ''
            const colored = `${ansi}${prefix}${ANSI_RESET}`
            if (level === 'error') {
                console.error(colored, ...msgs)
            } else if (level === 'warning') {
                console.warn(colored, ...msgs)
            } else {
                console.log(colored, ...msgs)
            }
        } else if (this.useColor) {
            const style = BROWSER_STYLES[level] ?? ''
            if (level === 'error') {
                console.error(`%c${prefix}`, style, ...msgs)
            } else if (level === 'warning') {
                console.warn(`%c${prefix}`, style, ...msgs)
            } else {
                console.log(`%c${prefix}`, style, ...msgs)
            }
        } else {
            if (level === 'error') {
                console.error(prefix, ...msgs)
            } else if (level === 'warning') {
                console.warn(prefix, ...msgs)
            } else {
                console.log(prefix, ...msgs)
            }
        }
    }

}

export default ConsoleLogReporter
