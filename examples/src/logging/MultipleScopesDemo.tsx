import { useState } from 'react'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'
import { captureLogs, LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `const factory = new LoggerFactory([new ConsoleLogReporter()])

const authLogger = factory.getLogger('auth')
const dbLogger = factory.getLogger('database')
const apiLogger = factory.getLogger('api')

authLogger.info('User login: alice@example.com')
dbLogger.debug('Query: SELECT * FROM users')
apiLogger.info('GET /api/users → 200')

// Console output includes scope:
// INFO [...] | auth: User login: alice@example.com
// DEBUG [...] | database: Query: SELECT * FROM users`

export const MultipleScopesDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
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
    }))
    return (
        <LoggingDemoCard
            title="Multiple Scopes"
            description="Use different scopes to identify log sources. Each scope creates a reusable logger instance."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default MultipleScopesDemo
