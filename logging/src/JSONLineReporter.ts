import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type JSONLineWriter = (line: string) => void

export interface JSONLineReporterOptions {
    write?: JSONLineWriter
    extra?: Record<string, any>
}

const defaultWrite: JSONLineWriter = line => console.log(line)

class JSONLineReporter extends LogReporter {

    private writeFn: JSONLineWriter
    private extra: Record<string, any>

    constructor(options: JSONLineReporterOptions = {}) {
        super()
        this.writeFn = options.write ?? defaultWrite
        this.extra = options.extra ?? {}
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const record = {
            ...this.extra,
            ...fields,
            level,
            scope,
            time,
            messages: messages.map(safe)
        }
        try {
            this.writeFn(JSON.stringify(record))
        } catch {
            this.writeFn(JSON.stringify({ ...this.extra, ...fields, level, scope, time, messages: ['<unserializable>'] }))
        }
    }

}

const safe = (value: any): any => {
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

export default JSONLineReporter
