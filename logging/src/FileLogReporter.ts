import { createWriteStream, unlinkSync, renameSync, type WriteStream } from 'node:fs'
import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type FileLogFormatter = (level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]) => string

export interface FileLogReporterOptions {
    append?: boolean
    formatter?: FileLogFormatter
    onError?: (err: Error) => void
    maxBytes?: number
    maxFiles?: number
}

const defaultFormatter: FileLogFormatter = (level, scope, time, _fields, messages) => {
    const body = messages.map(m => {
        if (m instanceof Error) return m.stack || m.message
        if (typeof m === 'object' && m !== null) {
            try { return JSON.stringify(m) } catch { return String(m) }
        }
        return String(m)
    }).join(' ')
    return `${level.toUpperCase()} [${new Date(time).toISOString()}] | ${scope}: ${body}`
}

class FileLogReporter extends LogReporter {

    private stream: WriteStream
    private readonly formatter: FileLogFormatter
    private readonly filePath: string
    private readonly maxBytes: number
    private readonly maxFiles: number
    private readonly onError?: (err: Error) => void
    private bytesWritten = 0
    private rotating = false
    private pending: string[] = []
    private rotationDone: Promise<void> | null = null

    constructor(filePath: string, options: FileLogReporterOptions = {}) {
        super()
        this.filePath = filePath
        this.maxBytes = options.maxBytes ?? 0
        this.maxFiles = options.maxFiles ?? 5
        this.onError = options.onError
        this.formatter = options.formatter ?? defaultFormatter
        const flags = options.append === false ? 'w' : 'a'
        this.stream = createWriteStream(filePath, { flags })
        this.stream.on('error', err => this.onError?.(err))
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const line = this.formatter(level, scope, time, fields, messages) + '\n'
        if (this.rotating) {
            this.pending.push(line)
            return
        }
        this.writeLine(line)
    }

    private writeLine(line: string): void {
        const lineBytes = Buffer.byteLength(line)
        if (this.maxBytes > 0 && this.bytesWritten + lineBytes > this.maxBytes) {
            this.pending.push(line)
            this.rotate()
            return
        }
        this.bytesWritten += lineBytes
        this.stream.write(line)
    }

    private rotate(): void {
        this.rotating = true
        this.rotationDone = new Promise<void>(resolve => {
            this.stream.end(() => {
                this.shiftFiles()
                this.bytesWritten = 0
                this.stream = createWriteStream(this.filePath, { flags: 'a' })
                this.stream.on('error', err => this.onError?.(err))
                this.rotating = false
                const flushed = this.pending.splice(0)
                for (const line of flushed) {
                    this.bytesWritten += Buffer.byteLength(line)
                    this.stream.write(line)
                }
                resolve()
            })
        })
    }

    private shiftFiles(): void {
        try { unlinkSync(`${this.filePath}.${this.maxFiles}`) } catch {}
        for (let i = this.maxFiles - 1; i >= 1; i--) {
            try { renameSync(`${this.filePath}.${i}`, `${this.filePath}.${i + 1}`) } catch {}
        }
        try { renameSync(this.filePath, `${this.filePath}.1`) } catch {}
    }

    close(): Promise<void> {
        const rotation = this.rotationDone ?? Promise.resolve()
        return rotation.then(() => new Promise(resolve => this.stream.end(() => resolve())))
    }

}

export default FileLogReporter
