import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type RedactionKeys = string[] | RegExp

const REDACTED = '[REDACTED]'
const CIRCULAR = '[Circular]'

export const DEFAULT_VALUE_PATTERNS: RegExp[] = [
    /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /\b(?:access_token|refresh_token|id_token|token|password|passwd|secret|api[_-]?key)\s*[=:]\s*[^\s&"',;]+/gi,
    /\bAuthorization\s*:\s*[^\r\n]+/gi,
]

const matchKey = (key: string, keys: RedactionKeys): boolean => {
    if (Array.isArray(keys)) return keys.includes(key)
    keys.lastIndex = 0
    return keys.test(key)
}

const globalize = (pattern: RegExp): RegExp =>
    pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + 'g')

const scrub = (value: string, patterns: RegExp[]): string => {
    let out = value
    for (const pattern of patterns) out = out.replace(pattern, REDACTED)
    return out
}

const setOwn = (target: Record<string, unknown>, key: string, value: unknown): void => {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
}

const redact = (value: unknown, keys: RedactionKeys, patterns: RegExp[], path: Set<object>): unknown => {
    if (typeof value === 'string') return scrub(value, patterns)
    if (value === null || typeof value !== 'object') return value
    const obj = value as object
    if (path.has(obj)) return CIRCULAR
    path.add(obj)
    try {
        if (Array.isArray(value)) {
            return value.map((item) => redact(item, keys, patterns, path))
        }
        if (value instanceof Error) {
            const copy = new Error(scrub(value.message, patterns))
            copy.name = value.name
            if (typeof value.stack === 'string') copy.stack = scrub(value.stack, patterns)
            for (const key of Object.keys(value)) {
                if (key === 'name' || key === 'message' || key === 'stack') continue
                const inner = (value as unknown as Record<string, unknown>)[key]
                Object.defineProperty(copy, key, {
                    value: matchKey(key, keys) ? REDACTED : redact(inner, keys, patterns, path),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                })
            }
            return copy
        }
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(obj)) {
            setOwn(
                result,
                key,
                matchKey(key, keys) ? REDACTED : redact((obj as Record<string, unknown>)[key], keys, patterns, path),
            )
        }
        return result
    } finally {
        path.delete(obj)
    }
}

class RedactionReporter extends LogReporter {

    private inner: LogReporter
    private keys: RedactionKeys
    private patterns: RegExp[]

    constructor(inner: LogReporter, keys: RedactionKeys, valuePatterns?: RegExp[]) {
        super()
        this.inner = inner
        this.keys = keys
        this.patterns = (valuePatterns ?? DEFAULT_VALUE_PATTERNS).map(globalize)
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const redactedFields = redact(fields, this.keys, this.patterns, new Set()) as Record<string, any>
        const redactedMessages = messages.map((m) => redact(m, this.keys, this.patterns, new Set()))
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
