import { type Writable } from 'node:stream'
import { type LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export type StreamLogFormatter = (level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]) => string

export interface StreamReporterOptions {
    formatter?: StreamLogFormatter
    onError?: (err: Error) => void
    maxBytes?: number
}

export const defaultStreamFormatter: StreamLogFormatter = (level, scope, time, _fields, messages) => {
    const body = messages.map(m => {
        if (m instanceof Error) return m.stack || m.message
        if (typeof m === 'object' && m !== null) {
            try { return JSON.stringify(m) } catch { return String(m) }
        }
        return String(m)
    }).join(' ')
    return `${level.toUpperCase()} [${new Date(time).toISOString()}] | ${scope}: ${body}`
}

class StreamReporter extends LogReporter {

    protected stream: Writable
    protected readonly formatter: StreamLogFormatter
    protected readonly maxBytes: number
    protected readonly onError?: (err: Error) => void
    protected bytesWritten = 0
    private rotating = false
    private pending: string[] = []
    private rotationDone: Promise<void> | null = null

    constructor(stream: Writable, options: StreamReporterOptions = {}) {
        super()
        this.stream = stream
        this.formatter = options.formatter ?? defaultStreamFormatter
        this.maxBytes = options.maxBytes ?? 0
        this.onError = options.onError
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
        this.rotationDone = this.openRotatedStream().then(() => {
            this.rotating = false
            const flushed = this.pending.splice(0)
            for (const line of flushed) {
                this.bytesWritten += Buffer.byteLength(line)
                this.stream.write(line)
            }
        })
    }

    // Override in subclasses to replace the stream (e.g. file rotation).
    // Must reset bytesWritten to 0 when done.
    protected openRotatedStream(): Promise<void> {
        this.bytesWritten = 0
        return Promise.resolve()
    }

    close(): Promise<void> {
        const rotation = this.rotationDone ?? Promise.resolve()
        return rotation.then(() => new Promise(resolve => this.stream.end(() => resolve())))
    }

}

export default StreamReporter
