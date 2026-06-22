import { useState } from 'react'
import { LoggerFactory, MemoryReporter } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory, MemoryReporter } from '@toolcase/logging'

const mem = new MemoryReporter()
const factory = new LoggerFactory([mem])
factory.level = 'verbose'

const log = factory.getLogger('app')
log.info('boot complete')
log.debug('detail', { step: 1 })
log.warning('slow query', { ms: 420 })
log.error('connection lost')
log.info('reconnected')

// All entries are retained — no draining
mem.entries()         // → LogEntry[] (all 5)
mem.find('info')      // → LogEntry[] (2 entries)
mem.find('error')     // → LogEntry[] (1 entry)

// Reset between test cases
mem.clear()
mem.entries()         // → []`

const MemoryReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const mem = new MemoryReporter()
        const factory = new LoggerFactory([mem])
        factory.level = 'verbose'
        const log = factory.getLogger('app')

        log.info('boot complete')
        log.debug('detail', { step: 1 })
        log.warning('slow query', { ms: 420 })
        log.error('connection lost')
        log.info('reconnected')

        const allEntries = mem.entries()
        const infoEntries = mem.find('info')

        const output: LogEntry[] = [
            {
                time: new Date().toLocaleTimeString(),
                text: `entries() → ${allEntries.length} total entries retained`,
                level: 'info',
            },
            ...allEntries.map(e => ({
                time: new Date(e.time).toLocaleTimeString(),
                text: `[${e.scope}] ${e.level.toUpperCase()}: ${e.messages.map(m =>
                    typeof m === 'object' ? JSON.stringify(m) : String(m)
                ).join(' ')}`,
                level: e.level,
            })),
            {
                time: new Date().toLocaleTimeString(),
                text: `find('info') → ${infoEntries.length} info entries`,
                level: 'info',
            },
        ]

        setLogs(output)
    }

    return (
        <LoggingDemoCard
            title="MemoryReporter"
            description={
                <>
                    Non-draining in-memory reporter designed for unit tests. Unlike{' '}
                    <code>BufferedReporter</code>, it never drains on read — call{' '}
                    <code>entries()</code> as many times as needed. Use{' '}
                    <code>find(level)</code> to filter by log level, and{' '}
                    <code>clear()</code> to reset between test cases.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default MemoryReporterDemo
