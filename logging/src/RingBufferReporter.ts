import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import type { LogEntry } from './BufferedReporter'

class RingBufferReporter extends LogReporter {

    private readonly cap: number
    private readonly buf: (LogEntry | undefined)[]
    private head: number = 0
    private count: number = 0

    constructor(capacity: number) {
        super()
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw new Error('RingBufferReporter: capacity must be a positive integer')
        }
        this.cap = capacity
        this.buf = new Array(capacity)
    }

    get size(): number {
        return this.count
    }

    get capacity(): number {
        return this.cap
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const entry: LogEntry = { level, scope, time, fields, messages }
        if (this.count < this.cap) {
            this.buf[(this.head + this.count) % this.cap] = entry
            this.count++
        } else {
            this.buf[this.head] = entry
            this.head = (this.head + 1) % this.cap
        }
    }

    snapshot(): LogEntry[] {
        const result: LogEntry[] = new Array(this.count)
        for (let i = 0; i < this.count; i++) {
            result[i] = this.buf[(this.head + i) % this.cap] as LogEntry
        }
        return result
    }

    clear(): void {
        this.head = 0
        this.count = 0
    }

}

export default RingBufferReporter
