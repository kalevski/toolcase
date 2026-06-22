import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

class SamplingReporter extends LogReporter {

    private inner: LogReporter
    private rate: number

    constructor(inner: LogReporter, rate: number) {
        super()
        if (rate < 0 || rate > 1) {
            throw new RangeError('SamplingReporter: rate must be between 0 and 1 inclusive')
        }
        this.inner = inner
        this.rate = rate
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        if (Math.random() < this.rate) {
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

export default SamplingReporter
