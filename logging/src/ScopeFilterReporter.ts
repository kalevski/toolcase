import type { LoggerLevel } from './Level'
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

class ScopeFilterReporter extends LogReporter {

    private inner: LogReporter
    private regex: RegExp

    constructor(inner: LogReporter, pattern: string) {
        super()
        this.inner = inner
        this.regex = scopePatternToRegex(pattern)
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        if (this.regex.test(scope)) {
            this.inner.log(level, scope, time, fields, messages)
        }
    }

    flush(): void {
        this.inner.flush()
    }

    close(): void | Promise<void> {
        return this.inner.close()
    }

}

export default ScopeFilterReporter
