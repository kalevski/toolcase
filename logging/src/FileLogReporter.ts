import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type FileLogFormatter = (level: LoggerLevel, scope: string, time: string, messages: any[]) => string

export interface FileLogReporterOptions {
    append?: boolean
    formatter?: FileLogFormatter
}

interface NodeWriteStream {
    write(chunk: string): boolean
    end(callback?: () => void): void
}

declare const require: ((id: string) => any) | undefined

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

    private stream: NodeWriteStream
    private formatter: FileLogFormatter

    constructor(filePath: string, options: FileLogReporterOptions = {}) {
        super()
        if (typeof require !== 'function') {
            throw new Error('FileLogReporter is only available in Node.js')
        }
        const fs = require('node:fs')
        const flags = options.append === false ? 'w' : 'a'
        this.stream = fs.createWriteStream(filePath, { flags })
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
