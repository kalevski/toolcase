import type { LoggerLevel } from './Level'
import LogReporter from './LogReporter'
import AsyncContext from './AsyncContext'

class ContextualReporter extends LogReporter {

    private inner: LogReporter
    private context: AsyncContext

    constructor(inner: LogReporter, context: AsyncContext) {
        super()
        this.inner = inner
        this.context = context
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const merged = { ...this.context.getFields(), ...fields }
        this.inner.log(level, scope, time, merged, messages)
    }

    flush(): void {
        this.inner.flush()
    }

    close(): void | Promise<void> {
        return this.inner.close()
    }

}

export default ContextualReporter
