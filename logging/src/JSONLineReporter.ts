import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import { type LogFormatter, jsonFormatter } from './Formatter'

export type JSONLineWriter = (line: string) => void

export interface JSONLineReporterOptions {
    write?: JSONLineWriter
    extra?: Record<string, any>
    formatter?: LogFormatter
}

const defaultWrite: JSONLineWriter = line => console.log(line)

class JSONLineReporter extends LogReporter {

    private writeFn: JSONLineWriter
    private extra: Record<string, any>
    private formatter: LogFormatter

    constructor(options: JSONLineReporterOptions = {}) {
        super()
        this.writeFn = options.write ?? defaultWrite
        this.extra = options.extra ?? {}
        this.formatter = options.formatter ?? jsonFormatter
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const mergedFields = { ...this.extra, ...fields }
        const line = this.formatter(level, scope, time, mergedFields, messages)
        this.writeFn(line)
    }

}

export default JSONLineReporter
