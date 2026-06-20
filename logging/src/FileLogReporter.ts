import { createWriteStream, type WriteStream } from 'node:fs'
import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type FileLogFormatter = (level: LoggerLevel, scope: string, time: string, messages: any[]) => string

export interface FileLogReporterOptions {
    append?: boolean
    formatter?: FileLogFormatter
}

const defaultFormatter: FileLogFormatter = (level, scope, time, messages) => {
    const body = messages.map(m => {
        if (m instanceof Error) return m.stack || m.message
        if (typeof m === 'object' && m !== null) {
            try { return JSON.stringify(m) } catch { return String(m) }
        }
        return String(m)
    }).join(' ')
    return `${level.toUpperCase()} [${time}] | ${scope}: ${body}`
}

class FileLogReporter extends LogReporter {

    private stream: WriteStream
    private formatter: FileLogFormatter

    constructor(filePath: string, options: FileLogReporterOptions = {}) {
        super()
        const flags = options.append === false ? 'w' : 'a'
        this.stream = createWriteStream(filePath, { flags })
        this.formatter = options.formatter ?? defaultFormatter
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        this.stream.write(this.formatter(level, scope, time, messages) + '\n')
    }

    close(): Promise<void> {
        return new Promise(resolve => {
            this.stream.end(() => resolve())
        })
    }

}

export default FileLogReporter
