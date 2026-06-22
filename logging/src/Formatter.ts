import { LoggerLevel } from './Level'

export type LogFormatter = (level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]) => string

function messageToString(m: any): string {
    if (m instanceof Error) return m.stack || m.message
    if (typeof m === 'object' && m !== null) {
        try { return JSON.stringify(m) } catch { return String(m) }
    }
    return String(m)
}

export const textFormatter: LogFormatter = (level, scope, time, _fields, messages) => {
    const body = messages.map(messageToString).join(' ')
    return `${level.toUpperCase()} [${new Date(time).toISOString()}] | ${scope}: ${body}`
}

function safeWalk(value: any): any {
    const seen = new WeakSet()
    const walk = (v: any): any => {
        if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack }
        if (typeof v === 'bigint') return v.toString()
        if (v && typeof v === 'object') {
            if (seen.has(v)) return '[Circular]'
            seen.add(v)
            if (Array.isArray(v)) return v.map(walk)
            const out: Record<string, any> = {}
            for (const k of Object.keys(v)) out[k] = walk(v[k])
            return out
        }
        return v
    }
    try { return walk(value) } catch { return '<unserializable>' }
}

export const jsonFormatter: LogFormatter = (level, scope, time, fields, messages) => {
    const record = { ...fields, level, scope, time, messages: messages.map(safeWalk) }
    try {
        return JSON.stringify(record)
    } catch {
        const fallback = { ...fields, level, scope, time, messages: ['<unserializable>'] }
        return JSON.stringify(fallback)
    }
}

function logfmtEscape(v: string): string {
    if (v === '') return '""'
    if (/[\s"=]/.test(v)) return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    return v
}

function messageToLogfmt(m: any): string {
    if (typeof m === 'string') return m
    if (m instanceof Error) return m.message
    try { return JSON.stringify(m) } catch { return String(m) }
}

export const logfmtFormatter: LogFormatter = (level, scope, time, fields, messages) => {
    const pairs: string[] = [
        `level=${level}`,
        `scope=${logfmtEscape(scope)}`,
        `ts=${new Date(time).toISOString()}`,
    ]
    for (const [k, v] of Object.entries(fields)) {
        pairs.push(`${k}=${logfmtEscape(String(v))}`)
    }
    const msg = messages.map(messageToLogfmt).join(' ')
    pairs.push(`msg=${logfmtEscape(msg)}`)
    return pairs.join(' ')
}
