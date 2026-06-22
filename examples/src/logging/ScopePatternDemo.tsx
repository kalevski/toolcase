import { useState } from 'react'
import { LoggerFactory, LogReporter } from '@toolcase/logging'
import { LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory } from '@toolcase/logging'

const factory = new LoggerFactory([reporter])
factory.level = 'warning'          // global threshold

// Pattern override — most-specific pattern wins
factory.setLevel('db:*', 'debug') // all db sub-scopes → debug
factory.setLevel('db:pool', 'info') // exact scope → info (beats db:*)

const db    = factory.getLogger('db')
const pool  = factory.getLogger('db:pool')
const query = factory.getLogger('db:query')

// Hierarchical scopes via .child()
const worker = pool.child('worker')   // scope: db:pool:worker
const stmt   = worker.child('stmt')  // scope: db:pool:worker:stmt

// Env-driven config
factory.parseEnv({ LOG_LEVEL: 'warning', DEBUG: 'auth*' })`

export const ScopePatternDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const entries: LogEntry[] = []
        const ts = () => new Date().toLocaleTimeString()

        class CaptureReporter extends LogReporter {
            log(level: string, scope: string, _time: number, _fields: any, messages: any[]) {
                entries.push({
                    time: ts(),
                    text: `${level.toUpperCase().padEnd(7)} | ${scope.padEnd(22)} | ${messages.join(' ')}`,
                    level,
                })
            }
        }

        const factory = new LoggerFactory([new CaptureReporter()])
        factory.level = 'warning'

        factory.setLevel('db:*', 'debug')
        factory.setLevel('db:pool', 'info')

        const db     = factory.getLogger('db')
        const pool   = factory.getLogger('db:pool')
        const query  = factory.getLogger('db:query')
        const worker = pool.child('worker')
        const auth   = factory.getLogger('auth')

        db.debug('db — global warning, no db:* match on "db" → dropped')
        pool.debug('pool — db:pool exact overrides db:* → needs ≥info → dropped')
        pool.info('pool — info allowed by db:pool pattern')
        query.debug('query — db:* pattern → debug allowed')
        worker.debug('worker (child) — db:pool:worker matches db:* → allowed')
        auth.debug('auth — no pattern, global warning → dropped')
        auth.warning('auth — warning passes global threshold')

        factory.parseEnv({ DEBUG: 'auth*' })
        factory.getLogger('auth').debug('auth — now enabled via DEBUG=auth*')
        factory.getLogger('auth:login').debug('auth:login — also matched by auth*')

        setLogs(entries)
    }

    return (
        <LoggingDemoCard
            title="Scope-pattern Level Control"
            description={
                <>
                    <code>factory.setLevel(pattern, level)</code> sets per-scope thresholds with glob
                    matching. <code>logger.child(scope)</code> creates a child logger (scope{' '}
                    <code>parent:child</code>). <code>factory.parseEnv({'{ LOG_LEVEL, DEBUG }'})</code>{' '}
                    reads env-driven config.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ScopePatternDemo
