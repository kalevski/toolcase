import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export interface ConsoleLogReporterOptions {
    color?: boolean
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

class ConsoleLogReporter extends LogReporter {

    private readonly useColor: boolean
    private readonly node: boolean

    constructor(options: ConsoleLogReporterOptions = {}) {
        super()
        this.node = isNode()
        this.useColor = resolveColor(options.color, this.node)
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        const prefix = `${level.toUpperCase()} [${time}] | ${scope}:`

        if (this.useColor && this.node) {
            const ansi = ANSI_COLORS[level] ?? ''
            const colored = `${ansi}${prefix}${ANSI_RESET}`
            if (level === 'error') {
                console.error(colored, ...messages)
            } else if (level === 'warning') {
                console.warn(colored, ...messages)
            } else {
                console.log(colored, ...messages)
            }
        } else if (this.useColor) {
            const style = BROWSER_STYLES[level] ?? ''
            if (level === 'error') {
                console.error(`%c${prefix}`, style, ...messages)
            } else if (level === 'warning') {
                console.warn(`%c${prefix}`, style, ...messages)
            } else {
                console.log(`%c${prefix}`, style, ...messages)
            }
        } else {
            if (level === 'error') {
                console.error(prefix, ...messages)
            } else if (level === 'warning') {
                console.warn(prefix, ...messages)
            } else {
                console.log(prefix, ...messages)
            }
        }
    }

}

export default ConsoleLogReporter
