import { useState } from 'react'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'
import {
    Button,
    Card,
    CodeSnippet,
    Heading,
    Select,
    TabSections,
    Text,
} from '@toolcase/react-components'

type LogEntry = { time: string; text: string; level?: string }

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
        <Card>
            <Heading as="h3">Basic Usage</Heading>
            <Text as="p" variant="muted">Create a logger factory, get a scoped logger, and log at different levels.</Text>
            <CodeSnippet language="typescript" code={`import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = 'verbose'

const logger = factory.getLogger('my-app')

logger.info('Server started on port 3000')
logger.debug('Loading configuration...')
logger.warning('Disk space below 10%')
logger.error('Connection to database failed')
logger.verbose('Request payload:', { method: 'GET', path: '/api/users' })`} />
            <Button size="small" onClick={run}>Run</Button>
            <ConsoleOutput logs={logs} />
        </Card>
    )
}

// ─── Log Levels ────────────────────────────────────
const levelOptions = [
    { value: 'silent', label: 'silent' },
    { value: 'error', label: 'error' },
    { value: 'warning', label: 'warning' },
    { value: 'info', label: 'info' },
    { value: 'debug', label: 'debug' },
    { value: 'verbose', label: 'verbose' },
]

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
        <Card>
            <Heading as="h3">Log Levels</Heading>
            <Text as="p" variant="muted">Set the factory level to filter messages. Only levels at or below the threshold are emitted.</Text>
            <Text as="p" variant="muted">
                Order: <code>silent</code> → <code>error</code> → <code>warning</code> → <code>info</code> → <code>debug</code> → <code>verbose</code>
            </Text>
            <CodeSnippet language="typescript" code={`const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = '${level}'  // only ${level} and below will show

logger.error('...')    // ${['error','warning','info','debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.warning('...')  // ${['warning','info','debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.info('...')     // ${['info','debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.debug('...')    // ${['debug','verbose'].indexOf(level) >= 0 ? '✓' : '✗'}
logger.verbose('...')  // ${level === 'verbose' ? '✓' : '✗'}`} />
            <div className="mb-2" style={{ maxWidth: 240 }}>
                <Select
                    label="Level"
                    options={levelOptions}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                />
            </div>
            <Button size="small" onClick={run}>Run</Button>
            <ConsoleOutput logs={logs} />
        </Card>
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
        <Card>
            <Heading as="h3">Multiple Scopes</Heading>
            <Text as="p" variant="muted">Use different scopes to identify log sources. Each scope creates a reusable logger instance.</Text>
            <CodeSnippet language="typescript" code={`const factory = new LoggerFactory([new ConsoleLogReporter()])

const authLogger = factory.getLogger('auth')
const dbLogger = factory.getLogger('database')
const apiLogger = factory.getLogger('api')

authLogger.info('User login: alice@example.com')
dbLogger.debug('Query: SELECT * FROM users')
apiLogger.info('GET /api/users → 200')

// Console output includes scope:
// INFO [...] | auth: User login: alice@example.com
// DEBUG [...] | database: Query: SELECT * FROM users`} />
            <Button size="small" onClick={run}>Run</Button>
            <ConsoleOutput logs={logs} />
        </Card>
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
                log(level: string, scope: string, _time: string, messages: any[]) {
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
        <Card>
            <Heading as="h3">Custom Reporter</Heading>
            <Text as="p" variant="muted">
                Extend <code>LogReporter</code> to send logs anywhere — files, remote APIs, or custom formats.
            </Text>
            <CodeSnippet language="typescript" code={`import { LogReporter, LoggerFactory } from '@toolcase/logging'

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
            <Button size="small" onClick={run}>Run</Button>
            <ConsoleOutput logs={logs} />
        </Card>
    )
}

export const LoggingExamplesPage = () => {
    const items = [
        { key: 'basic', label: 'Basic Usage', content: <BasicLoggingExample /> },
        { key: 'levels', label: 'Log Levels', content: <LogLevelExample /> },
        { key: 'scopes', label: 'Multiple Scopes', content: <MultipleScopesExample /> },
        { key: 'reporter', label: 'Custom Reporter', content: <CustomReporterExample /> },
    ]

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">@toolcase/logging</Heading>
                <Text as="p" variant="muted">Lightweight logger for Node.js and Browser — zero dependencies</Text>
            </div>
            <TabSections items={items} defaultActiveKey="basic" />
        </div>
    )
}
