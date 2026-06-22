import { useState } from 'react'
import { LoggerFactory, RingBufferReporter } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory, RingBufferReporter } from '@toolcase/logging'

const ring = new RingBufferReporter(5)
const factory = new LoggerFactory([ring])

const log = factory.getLogger('app')
log.info('boot')
log.debug('detail')
log.warning('slow query', { ms: 420 })
log.error('connection lost')
log.info('reconnected')
log.info('request handled')  // oldest entry ('boot') is evicted

// retrieve the last 5 entries
ring.snapshot()  // → LogEntry[]`

const RingBufferReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const ring = new RingBufferReporter(5)
        const factory = new LoggerFactory([ring])
        factory.level = 'verbose'
        const log = factory.getLogger('app')

        log.info('boot')
        log.debug('detail')
        log.warning('slow query', { ms: 420 })
        log.error('connection lost')
        log.info('reconnected')
        log.info('request handled')

        const entries: LogEntry[] = ring.snapshot().map(e => ({
            time: new Date(e.time).toLocaleTimeString(),
            text: `[${e.scope}] ${e.level.toUpperCase()}: ${e.messages.map(m =>
                typeof m === 'object' ? JSON.stringify(m) : String(m)
            ).join(' ')}`,
            level: e.level,
        }))

        setLogs(entries)
    }

    return (
        <LoggingDemoCard
            title="RingBufferReporter"
            description={
                <>
                    Keeps the last <code>N</code> log entries in a fixed-capacity ring buffer.
                    Oldest entries are silently evicted when the buffer is full.
                    Call <code>snapshot()</code> to retrieve all buffered entries for crash dumps,
                    debug overlays, or error reports.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default RingBufferReporterDemo
