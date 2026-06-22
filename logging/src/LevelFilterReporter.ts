import type { LoggerLevel } from './Level'
import { getLevelOrder } from './Level'
import LogReporter from './LogReporter'

class LevelFilterReporter extends LogReporter {

    private inner: LogReporter
    private minOrder: number

    constructor(inner: LogReporter, minLevel: LoggerLevel) {
        super()
        this.inner = inner
        this.minOrder = getLevelOrder(minLevel)
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        if (getLevelOrder(level) <= this.minOrder) {
            this.inner.log(level, scope, time, fields, messages)
        }
    }

    flush(): void {
        this.inner.flush()
    }

    close(): void | Promise<void> {
        return this.inner.close()
    }

}

export default LevelFilterReporter
