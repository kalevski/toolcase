import { useState } from 'react'
import { LoggerFactory, OTLPReporter, type OTLPTransport } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory, OTLPReporter, type OTLPTransport } from '@toolcase/logging'

// Inject a mock transport for demonstration:
const transport: OTLPTransport = async (url, body) => {
    console.log('POST', url, JSON.parse(body))
    return 200
}

const reporter = new OTLPReporter({
    url: 'https://otel-collector.example.com/v1/logs',
    headers: { 'otlp-api-key': 'my-api-key' },
    resource: { 'service.name': 'api', 'deployment.environment': 'prod' },
    maxSize: 3,
    flushInterval: 1000,
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

const OTLPReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = async () => {
        const entries: LogEntry[] = []

        const transport: OTLPTransport = async (url, body) => {
            const payload = JSON.parse(body)
            const scopeLogs = payload.resourceLogs[0]?.scopeLogs ?? []
            let totalRecords = 0
            for (const sl of scopeLogs) {
                totalRecords += sl.logRecords?.length ?? 0
            }
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: `POST ${url} — ${totalRecords} log record(s) across ${scopeLogs.length} scope(s):`,
                level: 'info',
            })
            for (const sl of scopeLogs) {
                for (const rec of sl.logRecords ?? []) {
                    entries.push({
                        time: '',
                        text: `  [${sl.scope.name}] ${rec.severityText} (${rec.severityNumber}): ${rec.body.stringValue}`,
                        level: rec.severityNumber >= 17 ? 'error'
                            : rec.severityNumber >= 13 ? 'warning' : 'info',
                    })
                }
            }
            return 200
        }

        const reporter = new OTLPReporter({
            url: 'https://otel-collector.example.com/v1/logs',
            headers: { 'otlp-api-key': 'my-api-key' },
            resource: { 'service.name': 'api', 'deployment.environment': 'prod' },
            maxSize: 3,
            flushInterval: 0,
            transport,
        })

        const factory = new LoggerFactory([reporter])
        factory.level = 'debug'
        const log = factory.getLogger('api').withContext({ requestId: 'req-42' })

        log.info('server started', { port: 3000 })
        log.warning('slow query', { ms: 320 })
        log.error('connection lost', { host: 'db' })

        await new Promise(resolve => setTimeout(resolve, 0))
        setLogs([...entries])
    }

    return (
        <LoggingDemoCard
            title="OTLPReporter"
            description={
                <>
                    Emits OTLP-shaped log records over HTTP JSON transport. Bridges
                    <code> level→severityNumber/Text</code> and maps
                    <code> scope/fields→attributes</code>. Supports resource attributes
                    for service metadata, configurable batch size and flush interval,
                    and exponential-backoff retry. Inject a <code>transport</code> for testing.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default OTLPReporterDemo
