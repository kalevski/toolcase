import { useState } from 'react'
import { LoggerFactory, ConsoleLogReporter, Level } from '@toolcase/logging'

type LogEntry = { time: string; text: string; level?: string }

const CodeBlock = ({ code }: { code: string }) => (
    <pre className="code-block">{code.trim()}</pre>
)

const ConsoleOutput = ({ logs }: { logs: LogEntry[] }) => (
    logs.length > 0 ? (
        <pre className="console-output">
            {logs.map((l, i) => (
                <div key={i} className={l.level ? `console-level--${l.level}` : ''}>
                    <span className="console-time">{l.time}</span> {l.text}
                </div>
            ))}
        </pre>
    ) : null
)

// ─── Basic Usage ───────────────────────────────────
const BasicLoggingExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const origLog = console.log
        const origWarn = console.warn
        const origError = console.error
        const capture = (level: string) => (...args: unknown[]) => {
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
                level,
            })
        }
        console.log = capture('info')
        console.warn = capture('warning')
        console.error = capture('error')

        try {
            const factory = new LoggerFactory([new ConsoleLogReporter()])
            factory.level = 'verbose'

            const logger = factory.getLogger('my-app')

            logger.info('Server started on port 3000')
            logger.debug('Loading configuration...')
            logger.warning('Disk space below 10%')
            logger.error('Connection to database failed')
            logger.verbose('Request payload:', { method: 'GET', path: '/api/users' })
        } finally {
            console.log = origLog
            console.warn = origWarn
            console.error = origError
        }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Basic Usage</h3>
            <p>Create a logger factory, get a scoped logger, and log at different levels.</p>
            <CodeBlock code={`import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = 'verbose'

const logger = factory.getLogger('my-app')

logger.info('Server started on port 3000')
logger.debug('Loading configuration...')
logger.warning('Disk space below 10%')
logger.error('Connection to database failed')
logger.verbose('Request payload:', { method: 'GET', path: '/api/users' })`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Log Levels ────────────────────────────────────
const LogLevelExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [level, setLevel] = useState<string>('info')
    const run = () => {
        const entries: LogEntry[] = []
        const capture = (lvl: string) => (...args: unknown[]) => {
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
                level: lvl,
            })
        }
        const origLog = console.log
        const origWarn = console.warn
        const origError = console.error
        console.log = capture('info')
        console.warn = capture('warning')
        console.error = capture('error')

        try {
            const factory = new LoggerFactory([new ConsoleLogReporter()])
            factory.level = level as any

            const logger = factory.getLogger('level-demo')

            entries.push({ time: new Date().toLocaleTimeString(), text: `── Level set to "${level}" ──` })
            logger.error('This is an error')
            logger.warning('This is a warning')
            logger.info('This is info')
            logger.debug('This is debug')
            logger.verbose('This is verbose')
            entries.push({ time: new Date().toLocaleTimeString(), text: `── Messages above "${level}" are filtered out ──` })
        } finally {
            console.log = origLog
            console.warn = origWarn
            console.error = origError
        }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Log Levels</h3>
            <p>Set the factory level to filter messages. Only levels at or below the threshold are emitted.</p>
            <p>Order: <code>silent</code> → <code>error</code> → <code>warning</code> → <code>info</code> → <code>debug</code> → <code>verbose</code></p>
            <CodeBlock code={`const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = '${level}'  // only ${level} and below will show

logger.error('...')    // ${['error','warning','info','debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.warning('...')  // ${['warning','info','debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.info('...')     // ${['info','debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.debug('...')    // ${['debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.verbose('...')  // ${level === 'verbose' ? '✓' : '✗'}`} />
            <div className="level-selector">
                {['silent', 'error', 'warning', 'info', 'debug', 'verbose'].map(l => (
                    <button
                        key={l}
                        className={`base-examples__tab ${level === l ? 'base-examples__tab--active' : ''}`}
                        onClick={() => setLevel(l)}
                    >
                        {l}
                    </button>
                ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={run} style={{ marginTop: 8 }}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Multiple Scopes ───────────────────────────────
const MultipleScopesExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const capture = (lvl: string) => (...args: unknown[]) => {
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
                level: lvl,
            })
        }
        const origLog = console.log; const origWarn = console.warn; const origError = console.error
        console.log = capture('info'); console.warn = capture('warning'); console.error = capture('error')

        try {
            const factory = new LoggerFactory([new ConsoleLogReporter()])
            factory.level = 'verbose'

            const authLogger = factory.getLogger('auth')
            const dbLogger = factory.getLogger('database')
            const apiLogger = factory.getLogger('api')

            authLogger.info('User login: alice@example.com')
            dbLogger.debug('Query: SELECT * FROM users WHERE email = ?')
            apiLogger.info('GET /api/users → 200')
            dbLogger.warning('Slow query detected (1200ms)')
            authLogger.error('Invalid token for session abc123')
            apiLogger.verbose('Response body:', { users: ['Alice', 'Bob'] })
        } finally { console.log = origLog; console.warn = origWarn; console.error = origError }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Multiple Scopes</h3>
            <p>Use different scopes to identify log sources. Each scope creates a reusable logger instance.</p>
            <CodeBlock code={`const factory = new LoggerFactory([new ConsoleLogReporter()])

const authLogger = factory.getLogger('auth')
const dbLogger = factory.getLogger('database')
const apiLogger = factory.getLogger('api')

authLogger.info('User login: alice@example.com')
dbLogger.debug('Query: SELECT * FROM users')
apiLogger.info('GET /api/users → 200')

// Console output includes scope:
// INFO [...] | auth: User login: alice@example.com
// DEBUG [...] | database: Query: SELECT * FROM users`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Custom Reporter ───────────────────────────────
const CustomReporterExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const ts = () => new Date().toLocaleTimeString()

        const factory = new LoggerFactory([
            {
                log(level: string, scope: string, time: string, messages: any[]) {
                    entries.push({
                        time: ts(),
                        text: `[Custom] ${level.toUpperCase()} | ${scope} | ${messages.join(' ')}`,
                        level,
                    })
                }
            } as any,
        ])
        factory.level = 'verbose'
        const logger = factory.getLogger('custom-demo')

        logger.info('Custom reporter captured this')
        logger.warning('Warnings work too')
        logger.debug('Debug info here')

        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Custom Reporter</h3>
            <p>Extend <code>LogReporter</code> to send logs anywhere — files, remote APIs, or custom formats.</p>
            <CodeBlock code={`import { LogReporter, LoggerFactory } from '@toolcase/logging'

class RemoteReporter extends LogReporter {
  log(level, scope, time, messages) {
    fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify({ level, scope, time, messages })
    })
  }
}

const factory = new LoggerFactory([
  new ConsoleLogReporter(),  // logs to console
  new RemoteReporter()       // also sends to API
])`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Page ──────────────────────────────────────────
const loggingExamples = [
    { key: 'basic', label: 'Basic Usage', element: <BasicLoggingExample /> },
    { key: 'levels', label: 'Log Levels', element: <LogLevelExample /> },
    { key: 'scopes', label: 'Multiple Scopes', element: <MultipleScopesExample /> },
    { key: 'reporter', label: 'Custom Reporter', element: <CustomReporterExample /> },
]

export const LoggingExamplesPage = () => {
    const [active, setActive] = useState('basic')
    const current = loggingExamples.find(e => e.key === active)

    return (
        <div className="example-menu">
            <div className="example-menu__header">
                <h1>@toolcase/logging</h1>
                <p>Lightweight logger for Node.js and Browser — zero dependencies</p>
            </div>
            <div className="base-examples">
                <div className="base-examples__tabs-row">
                    {loggingExamples.map(ex => (
                        <button
                            key={ex.key}
                            className={`base-examples__tab ${active === ex.key ? 'base-examples__tab--active' : ''}`}
                            onClick={() => setActive(ex.key)}
                        >
                            {ex.label}
                        </button>
                    ))}
                </div>
                <div className="base-examples__content">
                    {current?.element}
                </div>
            </div>
        </div>
    )
}
