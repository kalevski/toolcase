import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

class FanoutReporter extends LogReporter {

    private reporters: LogReporter[]

    constructor(reporters: LogReporter[]) {
        super()
        this.reporters = [...reporters]
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        for (const reporter of this.reporters) {
            try {
                reporter.log(level, scope, time, fields, messages)
            } catch (err) {
                console.error('[logging] FanoutReporter: reporter threw; isolating:', err)
            }
        }
    }

    flush(): void {
        for (const reporter of this.reporters) {
            try {
                reporter.flush()
            } catch (err) {
                console.error('[logging] FanoutReporter: reporter threw during flush; isolating:', err)
            }
        }
    }

    async close(): Promise<void> {
        for (const reporter of this.reporters) {
            try {
                await reporter.close()
            } catch (err) {
                console.error('[logging] FanoutReporter: reporter threw during close; isolating:', err)
            }
        }
    }

}

const MultiReporter = FanoutReporter

export { MultiReporter }
export default FanoutReporter
