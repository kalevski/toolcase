import { LoggerLevel, getLevel, getLevelOrder, isKnownLevel, KNOWN_LEVELS } from './Level'
import Logger from './Logger'
import LogReporter from './LogReporter'

function scopePatternToRegex(pattern: string): RegExp {
    let re = '^'
    for (const c of pattern) {
        if (c === '*') re += '.*'
        else if (/[.+?^${}()|[\]\\]/.test(c)) re += `\\${c}`
        else re += c
    }
    return new RegExp(re + '$')
}

function patternSpecificity(pattern: string): number {
    return pattern.split('*').join('').length
}

type PatternEntry = { pattern: string, re: RegExp, order: number, specificity: number }

class LoggerFactory {

    private loggers: Map<string, Logger> = new Map()
    private reporters: LogReporter[]
    private levelOrder!: number
    private clockFn: () => number
    private patternLevels: PatternEntry[] = []

    constructor(reporters: LogReporter[] = [], clock: () => number = Date.now) {
        this.reporters = reporters
        this.clockFn = clock
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

    setLevel(pattern: string, level: LoggerLevel): void {
        if (!isKnownLevel(level)) {
            throw new RangeError(`Unknown log level: "${level}". Valid levels: ${KNOWN_LEVELS.join(', ')}`)
        }
        const re = scopePatternToRegex(pattern)
        const order = getLevelOrder(level)
        const specificity = patternSpecificity(pattern)
        const existing = this.patternLevels.findIndex(p => p.pattern === pattern)
        if (existing !== -1) {
            this.patternLevels[existing] = { pattern, re, order, specificity }
        } else {
            this.patternLevels.push({ pattern, re, order, specificity })
        }
    }

    parseEnv(env: Record<string, string | undefined>): void {
        const logLevel = env['LOG_LEVEL']
        if (logLevel && isKnownLevel(logLevel)) {
            this.level = logLevel
        }
        const debug = env['DEBUG']
        if (debug) {
            const patterns = debug.split(/[\s,]+/).filter(Boolean)
            for (const pattern of patterns) {
                this.setLevel(pattern, 'debug')
            }
        }
    }

    getLogger(scope: string = 'default'): Logger {
        if (!this.loggers.has(scope)) {
            const logger = new Logger(scope, this.onLog, null, this.isEnabled, this.clockFn)
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

    flush(): void {
        for (const reporter of this.reporters) {
            try {
                reporter.flush()
            } catch (err) {
                console.error('[logging] reporter flush threw:', err)
            }
        }
    }

    async close(): Promise<void> {
        for (const reporter of this.reporters) {
            try {
                await reporter.close()
            } catch (err) {
                console.error('[logging] reporter close threw:', err)
            }
        }
    }

    private resolvePatternLevel(scope: string): number | null {
        let best: { specificity: number, order: number, index: number } | null = null
        for (let i = 0; i < this.patternLevels.length; i++) {
            const p = this.patternLevels[i]
            if (p.re.test(scope)) {
                if (
                    best === null ||
                    p.specificity > best.specificity ||
                    (p.specificity === best.specificity && i > best.index)
                ) {
                    best = { specificity: p.specificity, order: p.order, index: i }
                }
            }
        }
        return best !== null ? best.order : null
    }

    private isEnabled = (order: number, overrideOrder: number | null, scope: string): boolean => {
        const patternOrder = this.patternLevels.length ? this.resolvePatternLevel(scope) : null
        const threshold = overrideOrder ?? patternOrder ?? this.levelOrder
        return threshold >= order
    }

    private onLog = (level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[], overrideOrder?: number | null): void => {
        const order = getLevelOrder(level)
        const patternOrder = this.patternLevels.length ? this.resolvePatternLevel(scope) : null
        const threshold = (overrideOrder == null) ? (patternOrder ?? this.levelOrder) : overrideOrder
        if (threshold < order) {
            return
        }
        for (const reporter of this.reporters) {
            try {
                reporter.log(level, scope, time, fields, messages)
            } catch (err) {
                console.error('[logging] reporter threw; isolating:', err)
            }
        }
    }

}

export default LoggerFactory
