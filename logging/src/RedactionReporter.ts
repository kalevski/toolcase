import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type RedactionKeys = string[] | RegExp

const REDACTED = '[REDACTED]'

const matchKey = (key: string, keys: RedactionKeys): boolean =>
    Array.isArray(keys) ? keys.includes(key) : keys.test(key)

const redact = (value: unknown, keys: RedactionKeys, seen: WeakSet<object>): unknown => {
    if (value === null || typeof value !== 'object') return value
    if (value instanceof Error) return value
    if (seen.has(value as object)) return value
    seen.add(value as object)
    if (Array.isArray(value)) {
        return value.map((item) => redact(item, keys, seen))
    }
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as object)) {
        result[key] = matchKey(key, keys)
            ? REDACTED
            : redact((value as Record<string, unknown>)[key], keys, seen)
    }
    return result
}

class RedactionReporter extends LogReporter {

    private inner: LogReporter
    private keys: RedactionKeys

    constructor(inner: LogReporter, keys: RedactionKeys) {
        super()
        this.inner = inner
        this.keys = keys
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const redactedFields = redact(fields, this.keys, new WeakSet()) as Record<string, any>
        const redactedMessages = messages.map((m) => redact(m, this.keys, new WeakSet()))
        this.inner.log(level, scope, time, redactedFields, redactedMessages)
    }

    flush(): void {
        this.inner.flush()
    }

    close(): void | Promise<void> {
        return this.inner.close()
    }

}

export default RedactionReporter
