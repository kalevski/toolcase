import { useState } from 'react'
import {
    LoggerFactory,
    LogReporter,
    LevelFilterReporter,
    ScopeFilterReporter,
    RedactionReporter,
    SamplingReporter,
    FanoutReporter,
} from '@toolcase/logging'
import type { LoggerLevel } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import {
    LoggerFactory, LogReporter,
    LevelFilterReporter, ScopeFilterReporter,
    RedactionReporter, SamplingReporter, FanoutReporter,
} from '@toolcase/logging'

// Per-sink level threshold — only errors reach this sink
const errorOnly = new LevelFilterReporter(mySink, 'error')

// Scope filter — only 'audit:*' scopes reach this sink
const auditOnly = new ScopeFilterReporter(mySink, 'audit:*')

// Redaction — scrub sensitive fields before logging
const safe = new RedactionReporter(mySink, ['password', 'authorization'])

// Sampling — forward ~50 % of entries (high-throughput traces)
const sampled = new SamplingReporter(mySink, 0.5)

// FanoutReporter — broadcast to multiple sinks with independent policies
const fanout = new FanoutReporter([errorOnly, auditOnly, safe])

const factory = new LoggerFactory([fanout])
factory.level = 'verbose'`

class CaptureSink extends LogReporter {
    entries: { label: string; level: LoggerLevel; scope: string; messages: any[] }[] = []
    constructor(public label: string) { super() }
    log(level: LoggerLevel, scope: string, _t: number, _f: any, messages: any[]): void {
        this.entries.push({ label: this.label, level, scope, messages })
    }
}

const ComposableReportersDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const errorSink = new CaptureSink('error-only')
        const auditSink = new CaptureSink('audit:* only')
        const safeSink = new CaptureSink('redacted')

        const fanout = new FanoutReporter([
            new LevelFilterReporter(errorSink, 'error'),
            new ScopeFilterReporter(auditSink, 'audit:*'),
            new RedactionReporter(safeSink, ['password', 'authorization']),
        ])

        const factory = new LoggerFactory([fanout])
        factory.level = 'verbose'

        const app = factory.getLogger('app')
        const audit = factory.getLogger('audit:payments')

        app.info('server started')
        app.warning('slow query', { ms: 320 })
        app.error('unhandled error', { code: 503 })
        audit.info('charge attempt', { amount: 99, authorization: 'Bearer tok' })
        audit.error('charge failed', { password: 'do-not-log' })

        const sampledSink = new CaptureSink('sampled-50%')
        const sampled = new SamplingReporter(sampledSink, 0.5)
        const origRandom = Math.random
        let toggle = false
        Math.random = () => { toggle = !toggle; return toggle ? 0.3 : 0.7 }
        for (let i = 0; i < 6; i++) sampled.log('info', 'perf', 0, {}, [`trace-${i}`])
        Math.random = origRandom

        const allEntries = [
            ...errorSink.entries,
            ...auditSink.entries,
            ...safeSink.entries,
            ...sampledSink.entries,
        ]

        setLogs(
            allEntries.map((e) => ({
                time: new Date().toLocaleTimeString(),
                text: `[${e.label}] ${e.scope} — ${e.messages
                    .map((m) => (typeof m === 'object' ? JSON.stringify(m) : String(m)))
                    .join(' ')}`,
                level: e.level,
            })),
        )
    }

    return (
        <LoggingDemoCard
            title="Composable wrapper reporters"
            description={
                <>
                    Each wrapper reporter decorates one inner reporter.{' '}
                    <code>FanoutReporter</code> broadcasts to multiple sinks with independent per-sink
                    policies. The demo shows level filtering, scope filtering, field redaction, and 50 %
                    sampling in action.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ComposableReportersDemo
