import { useState } from 'react'
import { LoggerFactory, LogReporter, RingBufferReporter } from '@toolcase/logging'
import type { LoggerLevel } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory } from '@toolcase/logging'
import { AsyncContext, ContextualReporter } from '@toolcase/logging/node'
import { JSONLineReporter } from '@toolcase/logging'

const ctx = new AsyncContext()

const factory = new LoggerFactory([
    new ContextualReporter(new JSONLineReporter({ write: console.log }), ctx)
])
const log = factory.getLogger('handler')

// In HTTP middleware — no manual threading:
async function handleRequest(req) {
    await ctx.run({ requestId: req.headers['x-request-id'], traceId: uuid() }, async () => {
        log.info('request received')        // fields: { requestId, traceId }
        await processOrder()               // child async calls inherit the same context
        log.info('request complete')       // fields: { requestId, traceId }
    })
}

// Nested contexts merge; child wins on key conflict:
ctx.run({ requestId: 'r1', env: 'prod' }, () => {
    ctx.run({ env: 'staging', userId: 42 }, () => {
        log.info('nested')   // fields: { requestId: 'r1', env: 'staging', userId: 42 }
    })
})

// withContext() fields override ALS fields:
ctx.run({ requestId: 'r2', env: 'prod' }, () => {
    const scopedLog = log.withContext({ env: 'test' })
    scopedLog.info('scoped')  // fields: { requestId: 'r2', env: 'test' }
})`

class SimulatedAsyncContext {
    private stack: Record<string, any>[] = [{}]

    run<T>(fields: Record<string, any>, fn: () => T): T {
        const parent = this.stack[this.stack.length - 1]
        this.stack.push({ ...parent, ...fields })
        try { return fn() } finally { this.stack.pop() }
    }

    getFields(): Record<string, any> {
        return this.stack[this.stack.length - 1] ?? {}
    }
}

class SimulatedContextualReporter extends LogReporter {
    constructor(private inner: LogReporter, private context: SimulatedAsyncContext) {
        super()
    }

    log(level: LoggerLevel, scope: string, time: number, fields: Record<string, any>, messages: any[]): void {
        const merged = { ...this.context.getFields(), ...fields }
        this.inner.log(level, scope, time, merged, messages)
    }

    flush(): void { this.inner.flush() }

    close(): void | Promise<void> { return this.inner.close() }
}

const AsyncContextDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const ctx = new SimulatedAsyncContext()
        const ring = new RingBufferReporter(20)
        const factory = new LoggerFactory([new SimulatedContextualReporter(ring, ctx)])
        factory.level = 'verbose'
        const log = factory.getLogger('handler')

        ctx.run({ requestId: 'req-001', traceId: 'trace-abc' }, () => {
            log.info('request received')
            log.debug('processing order', { orderId: 'ord-42' })
            log.info('request complete')
        })

        ctx.run({ requestId: 'req-002', traceId: 'trace-def' }, () => {
            const scopedLog = log.withContext({ userId: 99 })
            scopedLog.info('authenticated request')
        })

        ctx.run({ requestId: 'req-003', env: 'prod' }, () => {
            ctx.run({ env: 'staging', userId: 7 }, () => {
                log.info('nested context — env overridden by child')
            })
        })

        const entries: LogEntry[] = ring.snapshot().map(e => ({
            time: new Date(e.time).toLocaleTimeString(),
            text: `[${e.scope}] ${e.level.toUpperCase()}: ${e.messages.map(m =>
                typeof m === 'object' ? JSON.stringify(m) : String(m)
            ).join(' ')} | fields: ${JSON.stringify(e.fields)}`,
            level: e.level,
        }))

        setLogs(entries)
    }

    return (
        <LoggingDemoCard
            title="AsyncContext (Node.js only)"
            description={
                <>
                    <code>AsyncContext</code> uses Node.js <code>AsyncLocalStorage</code> to carry
                    structured fields (request-id, trace-id) across async continuations automatically
                    — no logger threading required. Wrap any reporter with{' '}
                    <code>ContextualReporter</code> to inject the current context fields into every
                    emitted record. Nested <code>run()</code> calls inherit parent fields; child
                    fields win on key conflict. <code>withContext()</code> fields override ALS
                    fields. Available via <code>@toolcase/logging/node</code>.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default AsyncContextDemo
