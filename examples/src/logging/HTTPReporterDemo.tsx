import { useState } from 'react'
import { LoggerFactory, HTTPReporter, type HTTPTransport } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory, HTTPReporter, type HTTPTransport } from '@toolcase/logging'

// Inject a mock transport for demonstration:
const transport: HTTPTransport = async (url, body) => {
    console.log('POST', url, JSON.parse(body))
    return 200
}

const reporter = new HTTPReporter({
    url: 'https://ingest.example.com/logs',
    headers: { Authorization: 'Bearer my-token' },
    maxSize: 3,          // flush after 3 entries
    flushInterval: 1000, // or after 1 s
    retries: 3,
    retryMinTimeout: 500,
    transport,
})

const factory = new LoggerFactory([reporter])
factory.level = 'debug'

const log = factory.getLogger('api')
log.info('server started', { port: 3000 })
log.warning('slow query', { ms: 320 })
log.error('connection lost', { host: 'db' })
// maxSize=3 → batch flushed automatically

// On shutdown:
// reporter.close()`

const HTTPReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = async () => {
        const entries: LogEntry[] = []

        const transport: HTTPTransport = async (url, body) => {
            const parsed = JSON.parse(body)
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: `POST ${url} — batch of ${parsed.entries.length} entr${parsed.entries.length === 1 ? 'y' : 'ies'}:`,
                level: 'info',
            })
            for (const e of parsed.entries) {
                entries.push({
                    time: '',
                    text: `  [${e.scope}] ${e.level.toUpperCase()}: ${e.messages.map((m: unknown) =>
                        typeof m === 'object' ? JSON.stringify(m) : String(m)
                    ).join(' ')}`,
                    level: e.level,
                })
            }
            return 200
        }

        const reporter = new HTTPReporter({
            url: 'https://ingest.example.com/logs',
            headers: { Authorization: 'Bearer my-token' },
            maxSize: 3,
            flushInterval: 0,
            transport,
        })

        const factory = new LoggerFactory([reporter])
        factory.level = 'debug'
        const log = factory.getLogger('api')

        log.info('server started', { port: 3000 })
        log.warning('slow query', { ms: 320 })
        log.error('connection lost', { host: 'db' })

        await new Promise(resolve => setTimeout(resolve, 0))
        setLogs([...entries])
    }

    return (
        <LoggingDemoCard
            title="HTTPReporter"
            description={
                <>
                    Buffers log entries and POSTs each batch to a configurable URL as
                    <code>{' { entries: LogEntry[] } '}</code> JSON.
                    Supports custom headers for auth, configurable batch size and flush interval,
                    and exponential-backoff retry. Inject a <code>transport</code> function for
                    testing without real network calls.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default HTTPReporterDemo
