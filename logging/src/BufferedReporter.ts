import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export interface LogEntry {
    level: LoggerLevel
    scope: string
    time: string
    messages: any[]
}

export interface BufferedReporterOptions {
    maxSize?: number
    flushInterval?: number
    onFlush?: (entries: LogEntry[]) => void
}

const DEFAULT_MAX_SIZE = 50
const DEFAULT_FLUSH_INTERVAL = 1000

class BufferedReporter extends LogReporter {

    private inner: LogReporter | null
    private maxSize: number
    private flushInterval: number
    private onFlushFn: ((entries: LogEntry[]) => void) | null
    private buffer: LogEntry[] = []
    private timer: ReturnType<typeof setTimeout> | null = null

    constructor(inner: LogReporter | null, options: BufferedReporterOptions = {}) {
        super()
        if (inner === null && typeof options.onFlush !== 'function') {
            throw new Error('BufferedReporter: must provide an inner reporter or an onFlush handler')
        }
        this.inner = inner
        this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
        this.flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL
        this.onFlushFn = options.onFlush ?? null
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        this.buffer.push({ level, scope, time, messages })
        if (this.buffer.length >= this.maxSize) {
            this.flush()
            return
        }
        if (this.timer === null && this.flushInterval > 0) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval)
            if (typeof (this.timer as any)?.unref === 'function') (this.timer as any).unref()
        }
    }

    flush(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
        if (this.buffer.length === 0) {
            return
        }
        const entries = this.buffer
        this.buffer = []
        try {
            if (this.onFlushFn !== null) {
                this.onFlushFn(entries)
            } else if (this.inner !== null) {
                for (const entry of entries) {
                    this.inner.log(entry.level, entry.scope, entry.time, entry.messages)
                }
            }
        } catch {
            // a flush failure must not crash the caller
        }
    }

    close(): void {
        this.flush()
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    size(): number {
        return this.buffer.length
    }

}

export default BufferedReporter
