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

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        const record = {
            ...this.extra,
            level,
            scope,
            time,
            messages: messages.map(serialize)
        }
        try {
            this.writeFn(JSON.stringify(record))
        } catch {
            this.writeFn(JSON.stringify({ ...this.extra, level, scope, time, messages: ['<unserializable>'] }))
        }
    }

}

const serialize = (value: any): any => {
    if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack }
    }
    return value
}

export default JSONLineReporter
