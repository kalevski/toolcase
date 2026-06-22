import { useState } from 'react'
import { LoggerFactory } from '@toolcase/logging'
import { BeaconReporter } from '@toolcase/logging/browser'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory } from '@toolcase/logging'
import { BeaconReporter } from '@toolcase/logging/browser'

const reporter = new BeaconReporter({
    url: 'https://telemetry.example.com/logs',
    maxSize: 50,         // flush when buffer hits 50 entries
    flushInterval: 0,    // rely on maxSize + pagehide (default)
    captureErrors: true, // auto-wire window.onerror + unhandledrejection
})

const factory = new LoggerFactory([reporter])
factory.level = 'warning'

const log = factory.getLogger('app')
log.warning('disk space low', { freeGb: 1.2 })
log.error('payment failed', { orderId: 'ord-999', code: 402 })

// reporter.flush() — manual flush (or triggered automatically on pagehide)
// reporter.close() — flush + teardown`

const BeaconReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const entries: LogEntry[] = []
        const beacons: string[] = []

        const origNav = (globalThis as any).navigator
        ;(globalThis as any).navigator = {
            sendBeacon: (_url: string, data: string) => {
                beacons.push(data)
                return true
            },
        }

        try {
            const reporter = new BeaconReporter({
                url: 'https://telemetry.example.com/logs',
                maxSize: 10,
                flushInterval: 0,
            })

            const factory = new LoggerFactory([reporter])
            factory.level = 'warning'
            const log = factory.getLogger('app')

            log.warning('disk space low', { freeGb: 1.2 })
            log.error('payment failed', { orderId: 'ord-999', code: 402 })

            reporter.flush()

            for (const raw of beacons) {
                const batch = JSON.parse(raw) as any[]
                entries.push({
                    time: new Date().toLocaleTimeString(),
                    text: `sendBeacon — batch of ${batch.length} entr${batch.length === 1 ? 'y' : 'ies'}:`,
                    level: 'info',
                })
                for (const e of batch) {
                    entries.push({
                        time: '',
                        text: `  [${e.scope}] ${e.level.toUpperCase()}: ${e.messages.map((m: unknown) =>
                            typeof m === 'object' ? JSON.stringify(m) : String(m)
                        ).join(' ')}`,
                        level: e.level,
                    })
                }
            }
        } finally {
            ;(globalThis as any).navigator = origNav
        }

        setLogs([...entries])
    }

    return (
        <LoggingDemoCard
            title="BeaconReporter"
            description={
                <>
                    Buffers log entries in memory and flushes them via{' '}
                    <code>navigator.sendBeacon</code> — a fire-and-forget network call that is
                    guaranteed to complete even during page navigation. The underlying{' '}
                    <code>BufferedReporter</code> installs a <code>pagehide</code> listener
                    automatically. Enable <code>captureErrors</code> to wire{' '}
                    <code>window.onerror</code> and <code>unhandledrejection</code> with no
                    extra code. Browser only (<code>@toolcase/logging/browser</code>).
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default BeaconReporterDemo
