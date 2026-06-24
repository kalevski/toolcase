import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import { type LogEntry } from './BufferedReporter'

class MemoryReporter extends LogReporter {

    private _entries: LogEntry[] = []

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        this._entries.push({ level, scope, time, fields, messages })
    }

    entries(): LogEntry[] {
        return this._entries.slice()
    }

    find(level: LoggerLevel): LogEntry[] {
        return this._entries.filter(e => e.level === level)
    }

    clear(): void {
        this._entries = []
    }

}

export default MemoryReporter
